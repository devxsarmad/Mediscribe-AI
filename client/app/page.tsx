"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Database,
  FileAudio,
  FileText,
  FlaskConical,
  Loader2,
  Mic,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Toast } from "@/components/ui/toast";
import {
  API_BASE_URL,
  approveClinicalAgentRun,
  createClinicalAgentRunStream,
  listLisPatients,
  transcribeAudio,  
} from "@/lib/api";
import type {
  ClinicalAgentProgressEvent,
  ClinicalAgentRun,
  LisPatient,
  SoapNote,
} from "@/lib/api";
const soapFieldLabels: { key: keyof SoapNote; title: string }[] = [
  { key: "subjective", title: "Subjective" },
  { key: "objective", title: "Objective" },
  { key: "assessment", title: "Assessment" },
  { key: "plan", title: "Plan" },
];
const emptySoapNote: SoapNote = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
};
const timeline = [
  "Audio capture",
  "Speech-to-text",
  "SOAP generation",
  "Doctor review",
  "Save to record",
];
const agentActivitySteps = [
  {
    node: "load_patient_context",
    label: "Reviewing patient chart",
    detail: "Patient context and active clinical profile",
    icon: Search,
  },
  {
    node: "load_encounter_context",
    label: "Checking current visit",
    detail: "Encounter reason, provider, and visit type",
    icon: FileText,
  },
  {
    node: "load_recent_labs",
    label: "Reading recent labs",
    detail: "Latest LIS results and abnormal flags",
    icon: FlaskConical,
  },
  {
    node: "load_prior_notes",
    label: "Comparing prior notes",
    detail: "Previous clinical summaries for continuity",
    icon: Database,
  },
  {
    node: "prepare_context",
    label: "Preparing clinical context",
    detail: "Combining transcript with LIS context",
    icon: BrainCircuit,
  },
  {
    node: "generate_context_aware_soap",
    label: "Drafting SOAP note",
    detail: "Creating doctor-reviewable documentation",
    icon: Sparkles,
  },
];
type RecorderState = "idle" | "recording" | "recorded" | "error";
type TranscriptionState = "idle" | "loading" | "done" | "error";
type SoapGenerationState = "idle" | "loading" | "done" | "error";
type ReviewState = "draft" | "generated" | "reviewed" | "ready-to-save";
type SaveState = "idle" | "loading" | "saved" | "error";
function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
}
function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getSupportedMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}
export default function Home() {
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [recorderError, setRecorderError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [transcriptionState, setTranscriptionState] =useState<TranscriptionState>("idle");
  const [transcriptionError, setTranscriptionError] = useState("");
  const [soapNote, setSoapNote] = useState<SoapNote>(emptySoapNote);
  const [soapState, setSoapState] = useState<SoapGenerationState>("idle");
  const [soapError, setSoapError] = useState("");
  const [reviewState, setReviewState] = useState<ReviewState>("draft");
  const [reviewedAt, setReviewedAt] = useState("");
  const [reviewedAtIso, setReviewedAtIso] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const [transcriptionModel, setTranscriptionModel] = useState("");
  const [soapModel, setSoapModel] = useState("");
  const [agentRun, setAgentRun] = useState<ClinicalAgentRun | null>(null);
  const [agentActivityIndex, setAgentActivityIndex] = useState(0);
  const [agentStatusVisible, setAgentStatusVisible] = useState(true);
  const [agentActiveNode, setAgentActiveNode] = useState("");
  const [agentCompletedNodes, setAgentCompletedNodes] = useState<string[]>([]);
  const [patients, setPatients] = useState<LisPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientLoadState, setPatientLoadState] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [patientError, setPatientError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const workflowStats = useMemo(
    () => [
      {
        label: "Recording",
        value: recorderState === "recording" ? "Live" : audioBlob ? "Ready" : "Idle",
        icon: Mic,
      },
      {
        label: "Transcript",
        value:
          transcriptionState === "loading"
            ? "Processing"
            : transcriptionState === "done"
              ? "Ready"
              : transcript
                ? "Draft"
                : "Pending",
        icon: FileText,
      },
      {
        label: "SOAP",
        value:
          soapState === "loading"
            ? "Generating"
            : soapState === "done"
              ? "Ready"
              : Object.values(soapNote).some(Boolean)
                ? "Draft"
                : "AI pending",
        icon: Sparkles,
      },
      {
        label: "Review",
        value:
          reviewState === "reviewed" || reviewState === "ready-to-save"
            ? "Approved"
            : "Doctor owned",
        icon: ShieldCheck,
      },
    ],
    [
      audioBlob,
      recorderState,
      reviewState,
      soapNote,
      soapState,
      transcript,
      transcriptionState,
    ],
  );

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) || null,
    [patients, selectedPatientId],
  );

  const activeEncounterId = selectedPatient
    ? `current:${selectedPatient.id}`
    : "";

  const patientDetails = useMemo(
    () => [
      ["Patient", selectedPatient?.displayName || "Select patient"],
      ["MRN", selectedPatient?.mrn || "-"],
      ["Age", selectedPatient?.age ? String(selectedPatient.age) : "-"],
      ["Visit", "Primary care"],
    ],
    [selectedPatient],
  );

  useEffect(() => {
    if (recorderState !== "recording") {
      return;
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [recorderState]);

  useEffect(() => {
    let isMounted = true;

    async function loadPatients() {
      setPatientLoadState("loading");
      setPatientError("");

      try {
        const result = await listLisPatients();

        if (!isMounted) {
          return;
        }

        setPatients(result.patients);
        setSelectedPatientId((current) => current || result.patients[0]?.id || "");
        setPatientLoadState("done");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPatientLoadState("error");
        setPatientError(
          error instanceof Error
            ? error.message
            : "Could not load patients from LIS.",
        );
      }
    }

    loadPatients();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [audioUrl]);

  // Auto-collapse the "Context ready" pill a couple seconds after completion
  // so it doesn't linger and take up space once the SOAP note is drafted.
  useEffect(() => {
    if (soapState !== "done") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAgentStatusVisible(false);
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [soapState]);

  function handlePatientChange(patientId: string) {
    setSelectedPatientId(patientId);
    setSoapNote(emptySoapNote);
    setSoapState("idle");
    setSoapError("");
    setReviewState("draft");
    setReviewedAt("");
    setReviewedAtIso("");
    setReviewError("");
    setSaveState("idle");
    setSaveError("");
    setSaveSuccessMessage("");
    setAgentRun(null);
    resetAgentActivity();
    setSoapModel("");
  }

  function resetAgentActivity() {
    setAgentActivityIndex(0);
    setAgentActiveNode("");
    setAgentCompletedNodes([]);
  }

  function handleAgentProgress(event: ClinicalAgentProgressEvent) {
    if (event.type === "graph_started") {
      resetAgentActivity();
      setAgentStatusVisible(true);
      return;
    }

    const stepIndex = agentActivitySteps.findIndex(
      (step) => step.node === event.node,
    );

    if (event.type === "node_started" && stepIndex >= 0) {
      setAgentActiveNode(event.node || "");
      setAgentActivityIndex(stepIndex);
      return;
    }

    if (event.type === "node_completed" && stepIndex >= 0) {
      setAgentCompletedNodes((current) =>
        current.includes(event.node || "")
          ? current
          : current.concat(event.node || ""),
      );
      setAgentActiveNode("");
      setAgentActivityIndex(stepIndex);
      return;
    }

    if (event.type === "graph_completed") {
      const completed = (event.completedNodes || []).filter((node) =>
        agentActivitySteps.some((step) => step.node === node),
      );
      const lastCompleted = completed.at(-1);
      const lastIndex = agentActivitySteps.findIndex(
        (step) => step.node === lastCompleted,
      );

      setAgentCompletedNodes(completed);
      setAgentActiveNode("");
      setAgentActivityIndex(
        lastIndex >= 0 ? lastIndex : agentActivitySteps.length - 1,
      );
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecorderState("error");
      setRecorderError("This browser does not support microphone recording.");
      return;
    }

    try {
      setRecorderError("");
      setAudioBlob(null);
      setTranscript("");
      setTranscriptionState("idle");
      setTranscriptionError("");
      setSoapNote(emptySoapNote);
      setSoapState("idle");
      setSoapError("");
      setReviewState("draft");
      setReviewedAt("");
      setReviewedAtIso("");
      setReviewError("");
      setSaveState("idle");
      setSaveError("");
      setSaveSuccessMessage("");
      setTranscriptionModel("");
      setSoapModel("");
      setAgentRun(null);
      resetAgentActivity();
      setAgentStatusVisible(true);
      setElapsedSeconds(0);

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl("");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const recordedBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });

        setAudioBlob(recordedBlob);
        setAudioUrl(URL.createObjectURL(recordedBlob));
        setRecorderState("recorded");
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
      };

      mediaRecorder.start();
      setRecorderState("recording");
    } catch (error) {
      setRecorderState("error");
      setRecorderError(
        error instanceof Error
          ? error.message
          : "Microphone permission was denied or unavailable.",
      );
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  function resetRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setRecorderState("idle");
    setElapsedSeconds(0);
    setAudioBlob(null);
    setRecorderError("");
    setTranscript("");
    setTranscriptionState("idle");
    setTranscriptionError("");
    setSoapNote(emptySoapNote);
    setSoapState("idle");
    setSoapError("");
    setReviewState("draft");
    setReviewedAt("");
    setReviewedAtIso("");
    setReviewError("");
    setSaveState("idle");
    setSaveError("");
    setSaveSuccessMessage("");
    setTranscriptionModel("");
    setSoapModel("");
    setAgentRun(null);
    resetAgentActivity();
    setAgentStatusVisible(true);

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl("");
    }
  }

  async function handleTranscribe() {
    if (!audioBlob) {
      return;
    }

    setTranscriptionState("loading");
    setTranscriptionError("");

    try {
      const result = await transcribeAudio(audioBlob);
      setTranscript(result.transcript);
      setTranscriptionModel(result.model);
      setTranscriptionState("done");
      setSoapNote(emptySoapNote);
      setSoapState("idle");
      setSoapError("");
      setReviewState("draft");
      setReviewedAt("");
      setReviewedAtIso("");
      setReviewError("");
      setSaveState("idle");
      setSaveError("");
      setSaveSuccessMessage("");
      setSoapModel("");
      setAgentRun(null);
      resetAgentActivity();
    } catch (error) {
      setTranscriptionState("error");
      setTranscriptionError(
        error instanceof Error
          ? error.message
          : "Transcription failed. Check the API server and OpenAI key.",
      );
    }
  }

  async function handleGenerateSoap() {
    if (!transcript.trim()) {
      setSoapState("error");
      setSoapError("Add or transcribe a conversation before generating SOAP.");
      return;
    }

    if (!selectedPatient || !activeEncounterId) {
      setSoapState("error");
      setSoapError("Select a patient before generating SOAP.");
      return;
    }

    setSoapState("loading");
    setSoapError("");
    setAgentRun(null);
    resetAgentActivity();
    setAgentStatusVisible(true);

    try {
      const result = await createClinicalAgentRunStream(
        {
          patientId: selectedPatient.id,
          encounterId: activeEncounterId,
          transcript: transcript.trim(),
        },
        handleAgentProgress,
      );

      if (!result.state.generatedSoap) {
        setAgentRun(result);
        setSoapState("error");
        setSoapError(
          "The agent could not draft a SOAP note from this conversation yet.",
        );
        return;
      }

      setAgentRun(result);
      setSoapNote(result.state.generatedSoap);
      setSoapModel(result.agent);
      setSoapState("done");
      setReviewState("generated");
      setReviewedAt("");
      setReviewedAtIso("");
      setReviewError("");
      setSaveState("idle");
      setSaveError("");
      setSaveSuccessMessage("");
    } catch (error) {
      setSoapState("error");
      setSoapError(
        error instanceof Error
          ? error.message
          : "Agent SOAP generation failed. Check the API server, MongoDB, and AI configuration.",
      );
    }
  }

  function updateSoapField(key: keyof SoapNote, value: string) {
    setSoapNote((current) => ({ ...current, [key]: value }));
    setReviewState("draft");
    setReviewedAt("");
    setReviewedAtIso("");
    setReviewError("");
    setSaveState("idle");
    setSaveError("");
    setSaveSuccessMessage("");
    setAgentRun(null);
    resetAgentActivity();
    setSoapModel("");
  }

  function updateTranscript(value: string) {
    setTranscript(value);
    setReviewState("draft");
    setReviewedAt("");
    setReviewedAtIso("");
    setReviewError("");
    setSaveState("idle");
    setSaveError("");
    setSaveSuccessMessage("");
  }

  function markReviewed() {
    const hasSoapContent = Object.values(soapNote).some((value) => value.trim());

    if (!hasSoapContent) {
      setReviewError("Generate or enter SOAP content before marking reviewed.");
      return;
    }

    setReviewError("");
    setReviewState("reviewed");
    const now = new Date();
    setReviewedAt(now.toLocaleString());
    setReviewedAtIso(now.toISOString());
    setSaveState("idle");
    setSaveError("");
    setSaveSuccessMessage("");
  }

  async function prepareSave() {
    if (reviewState !== "reviewed" && reviewState !== "ready-to-save") {
      setReviewError("Doctor review is required before saving the note.");
      return;
    }

    setSaveState("loading");
    setSaveError("");
    setReviewError("");

    try {
      if (!agentRun?.id) {
        throw new Error("Generate an agent draft before saving this note.");
      }

      const result = await approveClinicalAgentRun(agentRun.id, {
        soap: soapNote,
        reviewedAt: reviewedAtIso || new Date().toISOString(),
      });

      resetRecording();
      setSaveSuccessMessage(`Saved note ID: ${result.savedNote.id}`);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to save note. Check the API server and MongoDB connection.",
      );
    }
  }

  const recordingStatus =
    recorderState === "recording"
      ? "Recording conversation"
      : recorderState === "recorded"
        ? transcriptionState === "loading"
          ? "Sending audio for transcription"
          : "Audio ready for transcription"
        : recorderState === "error"
          ? "Recording unavailable"
          : "Microphone ready";

  const transcriptBadge =
    transcriptionState === "loading"
      ? "Processing"
      : transcriptionState === "done"
        ? "Generated"
        : transcript
          ? "Draft"
          : "Awaiting audio";

  const soapBadge =
    soapState === "loading"
      ? "Generating"
      : soapState === "done"
        ? "Generated"
          : Object.values(soapNote).some(Boolean)
            ? "Draft"
            : "Awaiting transcript";

  const reviewBadge =
    reviewState === "reviewed" || reviewState === "ready-to-save"
      ? "Reviewed"
      : reviewState === "generated"
        ? "Needs review"
        : "Draft";

  const activeAgentStepIndex = agentActiveNode
    ? agentActivitySteps.findIndex((step) => step.node === agentActiveNode)
    : agentActivityIndex;
  const currentAgentStep =
    agentActivitySteps[
      activeAgentStepIndex >= 0 ? activeAgentStepIndex : agentActivityIndex
    ] || agentActivitySteps[0];
  const completedAgentStepCount = agentActivitySteps.filter((step) =>
    agentCompletedNodes.includes(step.node),
  ).length;
  const showAgentStatus =
    agentStatusVisible && (soapState === "loading" || soapState === "done") &&
    Boolean(agentRun || soapState === "loading");

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 bg-background/80 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-blue-200 bg-blue-50 text-blue-800">
                Medical Scribe AI
              </Badge>
              <Badge className="border-slate-200 bg-white text-slate-600">
                PHI sanitized before AI
              </Badge>
              <Badge className="border-slate-200 bg-white text-slate-500">
                API {API_BASE_URL}
              </Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Clinical note workspace
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={resetRecording} variant="outline" type="button">
              <RefreshCcw aria-hidden="true" />
              Reset
            </Button>
            <Button asChild variant="outline" type="button">
              <Link href="/notes">
                <FileText aria-hidden="true" />
                Saved notes
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Patient
                  </p>
                  <select
                    className="mt-2 h-10 min-w-64 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    disabled={patientLoadState === "loading" || !patients.length}
                    onChange={(event) => handlePatientChange(event.target.value)}
                    value={selectedPatientId}
                  >
                    {patients.length ? (
                      patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.displayName} ({patient.mrn})
                        </option>
                      ))
                    ) : (
                      <option value="">
                        {patientLoadState === "loading"
                          ? "Loading patients..."
                          : "No patients available"}
                      </option>
                    )}
                  </select>
                </div>
                <Badge className="w-fit border-blue-200 bg-blue-50 text-blue-700">
                  {patientLoadState === "loading"
                    ? "Loading LIS"
                    : patientLoadState === "done"
                      ? "LIS patient selected"
                      : "LIS unavailable"}
                </Badge>
              </div>

              {patientError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {patientError}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {patientDetails.map(([label, value]) => (
                  <div key={label} className="rounded-md bg-muted/60 p-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Encounter
                </p>
                <p className="mt-1 text-sm font-semibold">In progress</p>
              </div>
              <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                <Activity aria-hidden="true" className="mr-1 size-3" />
                Live draft
              </Badge>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Workflow actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <Button
                className="min-h-14 justify-start px-4"
                disabled={!audioBlob || transcriptionState === "loading"}
                onClick={handleTranscribe}
                type="button"
              >
                {transcriptionState === "loading" ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <FileText aria-hidden="true" />
                )}
                <span className="text-left">
                  <span className="block text-xs opacity-80">01</span>
                  <span>
                    {transcriptionState === "loading"
                      ? "Transcribing..."
                      : "Transcribe audio"}
                  </span>
                </span>
              </Button>
              <Button
                className="min-h-14 justify-start px-4"
                disabled={
                  soapState === "loading" ||
                  !transcript.trim() ||
                  !selectedPatient
                }
                onClick={handleGenerateSoap}
                type="button"
              >
                {soapState === "loading" ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <Sparkles aria-hidden="true" />
                )}
                <span className="text-left">
                  <span className="block text-xs opacity-80">02</span>
                  <span>
                    {soapState === "loading"
                      ? "Generating..."
                      : "Generate SOAP draft"}
                  </span>
                </span>
              </Button>
              <Button
                className="min-h-14 justify-start px-4"
                disabled={
                  soapState === "loading" ||
                  !Object.values(soapNote).some((value) => value.trim())
                }
                onClick={markReviewed}
                variant="outline"
                type="button"
              >
                <ClipboardCheck aria-hidden="true" />
                <span className="text-left">
                  <span className="block text-xs text-muted-foreground">03</span>
                  <span>Mark reviewed</span>
                </span>
              </Button>
              <Button
                className="min-h-14 justify-start px-4"
                disabled={
                  saveState === "loading" ||
                  (reviewState !== "reviewed" && reviewState !== "ready-to-save")
                }
                onClick={prepareSave}
                type="button"
              >
                {saveState === "loading" ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <Save aria-hidden="true" />
                )}
                <span className="text-left">
                  <span className="block text-xs opacity-80">04</span>
                  <span>{saveState === "loading" ? "Saving..." : "Save note"}</span>
                </span>
              </Button>
            </div>

            {/* Compact single-line agent status — mirrors Claude's "gathering info..." indicator.
                Cycles through steps in place instead of a tall scrollable card list. */}
            {showAgentStatus ? (
              <div
                className={`mt-3 flex items-center gap-3 rounded-full border px-4 py-2.5 transition-colors duration-300 ${
                  soapState === "loading"
                    ? "border-blue-200 bg-blue-50"
                    : "border-emerald-200 bg-emerald-50"
                }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    soapState === "loading"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {soapState === "loading" ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 aria-hidden="true" className="size-4" />
                  )}
                </div>
                <p
                  key={soapState === "loading" ? currentAgentStep.node : "done"}
                  className={`min-w-0 flex-1 truncate text-sm font-medium ${
                    soapState === "loading" ? "text-blue-900" : "text-emerald-800"
                  }`}
                >
                  {soapState === "loading"
                    ? `${currentAgentStep.label}...`
                    : "Context gathered — SOAP draft ready"}
                </p>
                {soapState === "loading" ? (
                  <div className="flex shrink-0 items-center gap-1">
                    {agentActivitySteps.map((step, index) => (
                      <span
                        key={step.node}
                        className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                          agentCompletedNodes.includes(step.node) ||
                          index === activeAgentStepIndex
                            ? "bg-blue-600"
                            : "bg-blue-200"
                        }`}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="shrink-0 text-xs font-medium text-emerald-700">
                    Step {completedAgentStepCount}/{agentActivitySteps.length}
                  </span>
                )}
              </div>
            ) : null}

            {transcriptionError ? (
              <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {transcriptionError}
              </div>
            ) : null}
            {reviewError ? (
              <div
                className={`mt-3 rounded-md border p-3 text-sm ${
                  reviewState === "ready-to-save"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}
              >
                {reviewError}
              </div>
            ) : null}
            {saveError ? (
              <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {saveError}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <section className="grid gap-4 xl:grid-cols-[380px_1fr_360px]">
          <aside className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Recording</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-blue-200 bg-blue-50/50 p-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    {recorderState === "recording" ? (
                      <Mic aria-hidden="true" />
                    ) : (
                      <FileAudio aria-hidden="true" />
                    )}
                  </div>
                  <p className="mt-3 text-2xl font-semibold">
                    {formatDuration(elapsedSeconds)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {recordingStatus}
                  </p>
                  {audioBlob ? (
                    <p className="mt-2 text-xs font-medium text-blue-700">
                      {formatBytes(audioBlob.size)} captured
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    disabled={recorderState === "recording"}
                    onClick={startRecording}
                    type="button"
                  >
                    <Mic aria-hidden="true" />
                    Start
                  </Button>
                  <Button
                    disabled={recorderState !== "recording"}
                    onClick={stopRecording}
                    variant="outline"
                    type="button"
                  >
                    <Square aria-hidden="true" />
                    Stop
                  </Button>
                </div>
                {audioUrl ? (
                  <audio className="w-full" controls src={audioUrl}>
                    <track kind="captions" />
                  </audio>
                ) : null}
                {recorderError ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {recorderError}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {workflowStats.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        className="flex items-center justify-between gap-3 rounded-md border bg-background p-3"
                        key={item.label}
                      >
                        <div className="flex items-center gap-3">
                          <Icon aria-hidden="true" className="size-4 text-blue-700" />
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {item.value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="flex flex-col gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>Transcript</CardTitle>
                <Badge className="bg-secondary text-secondary-foreground">
                  {transcriptBadge}
                </Badge>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="min-h-72"
                  onChange={(event) => updateTranscript(event.target.value)}
                  placeholder="Record audio, then transcribe to populate the raw conversation text here."
                  value={transcript}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Workflow timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-5">
                  {timeline.map((item, index) => (
                    <div
                      className="flex min-h-20 flex-col justify-between rounded-md border bg-background p-3"
                      key={item}
                    >
                      <span className="text-xs font-semibold text-blue-700">
                        0{index + 1}
                      </span>
                      <span className="text-sm font-medium leading-5">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <aside className="flex flex-col gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>SOAP note</CardTitle>
                <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                  {soapBadge}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {soapFieldLabels.map((section) => (
                  <div key={section.key}>
                    <label className="mb-2 block text-sm font-semibold">
                      {section.title}
                    </label>
                    <Textarea
                      onChange={(event) =>
                        updateSoapField(section.key, event.target.value)
                      }
                      placeholder={`${section.title} findings will appear here after SOAP generation.`}
                      value={soapNote[section.key]}
                    />
                  </div>
                ))}
                {soapError ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {soapError}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>Review actions</CardTitle>
                <Badge
                  className={
                    reviewState === "reviewed" || reviewState === "ready-to-save"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "bg-secondary text-secondary-foreground"
                  }
                >
                  {reviewBadge}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
                  <Clock3 aria-hidden="true" className="size-4" />
                  <span>
                    {reviewedAt
                      ? `Reviewed at ${reviewedAt}`
                      : "Review timestamp pending"}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                  <span>
                    {reviewState === "reviewed" ||
                    reviewState === "ready-to-save"
                      ? "Doctor approval complete"
                      : "Doctor approval stays required"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
      {saveSuccessMessage ? (
        <Toast
          description={saveSuccessMessage}
          onClose={() => setSaveSuccessMessage("")}
          title="Note saved successfully"
        />
      ) : null}
    </main>
  );
}
