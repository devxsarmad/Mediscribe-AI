"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ClipboardList,
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
  approveClinicalAgentRun,
  createClinicalAgentRunStream,
  listLisPatients,
  regenerateClinicalAgentIcdSuggestions,
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
const soapSectionTitles: Record<keyof SoapNote, string> = {
  subjective: "Subjective",
  objective: "Objective",
  assessment: "Assessment",
  plan: "Plan",
};
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
  {
    node: "review_safety_warnings",
    label: "Checking safety gaps",
    detail: "Missing information and review warnings",
    icon: AlertTriangle,
  },
  {
    node: "validate_soap_claims",
    label: "Validating SOAP claims",
    detail: "Checking draft against source transcript",
    icon: ShieldCheck,
  },
  {
    node: "suggest_icd_codes",
    label: "Suggesting ICD codes",
    detail: "Advisory coding options for doctor review",
    icon: ClipboardList,
  },
];
type RecorderState = "idle" | "recording" | "recorded" | "error";
type TranscriptionState = "idle" | "loading" | "done" | "error";
type SoapGenerationState = "idle" | "loading" | "done" | "error";
type ReviewState = "draft" | "generated" | "reviewed" | "ready-to-save";
type SaveState = "idle" | "loading" | "saved" | "error";
type IcdRegenerationState = "idle" | "loading" | "error";
type ReviewPanelTab = "edits" | "safety" | "validation" | "icd";
type WorkspaceTab = "capture" | "transcript" | "soap" | "review";
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

function getChangedSoapSections(original?: SoapNote | null, reviewed?: SoapNote) {
  if (!original || !reviewed) {
    return [];
  }

  return (Object.keys(soapSectionTitles) as (keyof SoapNote)[]).filter(
    (section) => original[section].trim() !== reviewed[section].trim(),
  );
}

function normalizeClinicalText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasIcdRelevantPlanChange(original: string, reviewed: string) {
  if (normalizeClinicalText(original) === normalizeClinicalText(reviewed)) {
    return false;
  }

  const text = normalizeClinicalText(`${original} ${reviewed}`);
  const icdRelevantTerms = [
    "diagnosis",
    "diagnosed",
    "assessment",
    "infection",
    "migraine",
    "fracture",
    "diabetes",
    "hypertension",
    "asthma",
    "pneumonia",
    "covid",
    "strep",
    "uti",
    "pharyngitis",
    "bronchitis",
    "sinusitis",
    "headache",
    "fever",
    "cough",
    "sore throat",
    "pain",
  ];

  return icdRelevantTerms.some((term) => text.includes(term));
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
  const [icdRegenerationState, setIcdRegenerationState] =
    useState<IcdRegenerationState>("idle");
  const [icdRegenerationError, setIcdRegenerationError] = useState("");
  const [icdBaselineSoap, setIcdBaselineSoap] = useState<SoapNote | null>(null);
  const [reviewPanelTab, setReviewPanelTab] =
    useState<ReviewPanelTab>("edits");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("capture");
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
    setIcdRegenerationState("idle");
    setIcdRegenerationError("");
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
      setIcdBaselineSoap(null);
      setIcdRegenerationState("idle");
      setIcdRegenerationError("");
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
    setIcdBaselineSoap(null);
    setIcdRegenerationState("idle");
    setIcdRegenerationError("");
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
      setIcdBaselineSoap(null);
      setIcdRegenerationState("idle");
      setIcdRegenerationError("");
      resetAgentActivity();
      setWorkspaceTab("transcript");
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
    setIcdBaselineSoap(null);
    setIcdRegenerationState("idle");
    setIcdRegenerationError("");
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
        setIcdBaselineSoap(null);
        setSoapState("error");
        setSoapError(
          "The agent could not draft a SOAP note from this conversation yet.",
        );
        return;
      }

      setAgentRun(result);
      setSoapNote(result.state.generatedSoap);
      setIcdBaselineSoap(result.state.generatedSoap);
      setSoapModel(result.agent);
      setSoapState("done");
      setReviewState("generated");
      setReviewedAt("");
      setReviewedAtIso("");
      setReviewError("");
      setSaveState("idle");
      setSaveError("");
      setSaveSuccessMessage("");
      setWorkspaceTab("soap");
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
    setIcdRegenerationState("idle");
    setIcdRegenerationError("");
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
    setWorkspaceTab("review");
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

  async function handleRegenerateIcdSuggestions() {
    if (!agentRun?.id) {
      setIcdRegenerationError("Generate an agent draft before refreshing ICD suggestions.");
      return;
    }

    setIcdRegenerationState("loading");
    setIcdRegenerationError("");

    try {
      const result = await regenerateClinicalAgentIcdSuggestions(agentRun.id, {
        soap: soapNote,
      });

      setAgentRun(result.run);
      setIcdBaselineSoap(soapNote);
      setIcdRegenerationState("idle");
    } catch (error) {
      setIcdRegenerationState("error");
      setIcdRegenerationError(
        error instanceof Error
          ? error.message
          : "Failed to regenerate ICD suggestions.",
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
  const changedSoapSections = useMemo(
    () => getChangedSoapSections(agentRun?.state.generatedSoap, soapNote),
    [agentRun?.state.generatedSoap, soapNote],
  );
  const safetyWarnings = agentRun?.state.safetyWarnings ?? [];
  const validationIssues = agentRun?.state.validationIssues ?? [];
  const icdSuggestions = agentRun?.state.icdSuggestions ?? [];
  const icdSuggestionsMayBeOutdated =
    icdSuggestions.length > 0 &&
    Boolean(
      (icdBaselineSoap &&
        normalizeClinicalText(icdBaselineSoap.assessment) !==
          normalizeClinicalText(soapNote.assessment)) ||
        (icdBaselineSoap &&
          hasIcdRelevantPlanChange(icdBaselineSoap.plan, soapNote.plan)),
    );
  const reviewPanelTabs: {
    key: ReviewPanelTab;
    label: string;
    count: number;
    tone: "default" | "warning" | "danger";
  }[] = [
    {
      key: "edits",
      label: "Edits",
      count: changedSoapSections.length,
      tone: "default",
    },
    {
      key: "safety",
      label: "Safety",
      count: safetyWarnings.length,
      tone: safetyWarnings.some((item) => item.severity === "warning")
        ? "warning"
        : "default",
    },
    {
      key: "validation",
      label: "Validation",
      count: validationIssues.length,
      tone: validationIssues.some((item) => item.severity === "warning")
        ? "danger"
        : "default",
    },
    {
      key: "icd",
      label: "ICD",
      count: icdSuggestions.length,
      tone: icdSuggestionsMayBeOutdated ? "warning" : "default",
    },
  ];
  const showAgentStatus =
    agentStatusVisible && (soapState === "loading" || soapState === "done") &&
    Boolean(agentRun || soapState === "loading");

  const workspaceTabs: {
    key: WorkspaceTab;
    label: string;
    badge: string;
  }[] = [
    { key: "capture", label: "Capture", badge: recorderState === "recording" ? "Live" : audioBlob ? "Ready" : "Start" },
    { key: "transcript", label: "Transcript", badge: transcriptBadge },
    { key: "soap", label: "SOAP draft", badge: soapBadge },
    { key: "review", label: "Review & coding", badge: reviewBadge },
  ];

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-blue-200 bg-blue-50 text-blue-800">
                Medical Scribe AI
              </Badge>
              <Badge className="border-slate-200 bg-white text-slate-600">
                PHI sanitized
              </Badge>
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-normal sm:text-2xl">
              Clinical note workspace
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <select
              className="h-9 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
            <Button onClick={resetRecording} size="sm" variant="outline" type="button">
              <RefreshCcw aria-hidden="true" />
              Reset
            </Button>
            <Button asChild size="sm" variant="outline" type="button">
              <Link href="/notes">
                <FileText aria-hidden="true" />
                Saved notes
              </Link>
            </Button>
          </div>
        </div>

        {patientError ? (
          <div className="mx-auto mt-3 max-w-[1440px] rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {patientError}
          </div>
        ) : null}

        <div className="mx-auto mt-3 hidden max-w-[1440px] gap-2 md:grid md:grid-cols-4">
          {patientDetails.map(([label, value]) => (
            <div key={label} className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-[10px] font-medium uppercase text-muted-foreground">
                {label}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </header>

      <nav className="shrink-0 border-b border-slate-200 bg-white px-4 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto py-2">
          {workspaceTabs.map((tab) => (
            <button
              className={`flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                workspaceTab === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
              key={tab.key}
              onClick={() => setWorkspaceTab(tab.key)}
              type="button"
            >
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  workspaceTab === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.badge}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-[1440px]">
          {workspaceTab === "capture" ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <Card>
                <CardHeader>
                  <CardTitle>Recording</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-6 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      {recorderState === "recording" ? (
                        <Mic aria-hidden="true" className="size-6" />
                      ) : (
                        <FileAudio aria-hidden="true" className="size-6" />
                      )}
                    </div>
                    <p className="mt-4 text-3xl font-semibold tabular-nums">
                      {formatDuration(elapsedSeconds)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{recordingStatus}</p>
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
                <CardContent className="space-y-2">
                  {workflowStats.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
                        key={item.label}
                      >
                        <div className="flex items-center gap-2">
                          <Icon aria-hidden="true" className="size-4 text-blue-700" />
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{item.value}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {workspaceTab === "transcript" ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>Transcript</CardTitle>
                <Badge className="bg-secondary text-secondary-foreground">
                  {transcriptBadge}
                </Badge>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="min-h-[calc(100dvh-320px)] resize-y"
                  onChange={(event) => updateTranscript(event.target.value)}
                  placeholder="Record audio on the Capture tab, then transcribe to populate the conversation here."
                  value={transcript}
                />
              </CardContent>
            </Card>
          ) : null}

          {workspaceTab === "soap" ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>SOAP draft</CardTitle>
                <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                  {soapBadge}
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                {soapFieldLabels.map((section) => (
                  <div key={section.key} className="flex flex-col">
                    <label className="mb-2 block text-sm font-semibold">
                      {section.title}
                    </label>
                    <Textarea
                      className="min-h-40 flex-1"
                      onChange={(event) =>
                        updateSoapField(section.key, event.target.value)
                      }
                      placeholder={`${section.title} will appear here after generation.`}
                      value={soapNote[section.key]}
                    />
                  </div>
                ))}
                {soapError ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive lg:col-span-2">
                    {soapError}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {workspaceTab === "review" ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="flex items-center gap-3 pt-6">
                    <Clock3 aria-hidden="true" className="size-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Review status
                      </p>
                      <p className="text-sm font-semibold">
                        {reviewedAt
                          ? `Reviewed at ${reviewedAt}`
                          : "Review timestamp pending"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 pt-6">
                    <CheckCircle2
                      aria-hidden="true"
                      className={`size-5 ${
                        reviewState === "reviewed" || reviewState === "ready-to-save"
                          ? "text-blue-700"
                          : "text-muted-foreground"
                      }`}
                    />
                    <div>
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Approval
                      </p>
                      <p className="text-sm font-semibold">
                        {reviewState === "reviewed" || reviewState === "ready-to-save"
                          ? "Doctor approval complete"
                          : "Doctor approval required"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {agentRun?.state.generatedSoap ? (
                <Card>
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle>Review intelligence</CardTitle>
                      <Badge className="border-slate-200 bg-white text-slate-600">
                        Agent context
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
                      {reviewPanelTabs.map((tab) => (
                        <button
                          className={`flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
                            reviewPanelTab === tab.key
                              ? "bg-white text-slate-950 shadow-sm"
                              : "text-muted-foreground hover:bg-white/70"
                          }`}
                          key={tab.key}
                          onClick={() => setReviewPanelTab(tab.key)}
                          type="button"
                        >
                          {tab.label}
                          {tab.count ? (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                                tab.tone === "danger"
                                  ? "bg-rose-100 text-rose-700"
                                  : tab.tone === "warning"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {tab.count}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {reviewPanelTab === "edits" ? (
                      changedSoapSections.length ? (
                        <div className="flex flex-wrap gap-2">
                          {changedSoapSections.map((section) => (
                            <Badge
                              className="border-blue-200 bg-white text-blue-700"
                              key={section}
                            >
                              {soapSectionTitles[section]}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-md bg-muted/60 p-4 text-sm text-muted-foreground">
                          <ClipboardCheck aria-hidden="true" className="size-4" />
                          <span>Doctor has not changed the AI draft yet.</span>
                        </div>
                      )
                    ) : null}

                    {reviewPanelTab === "safety" ? (
                      safetyWarnings.length ? (
                        <div className="grid gap-2 lg:grid-cols-2">
                          {safetyWarnings.map((warning, index) => (
                            <div
                              className={`flex gap-2 rounded-md border p-3 text-sm ${
                                warning.severity === "warning"
                                  ? "border-amber-200 bg-amber-50 text-amber-900"
                                  : "border-blue-100 bg-blue-50 text-blue-800"
                              }`}
                              key={`${warning.code}-${index}`}
                            >
                              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                              <span>{warning.message}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-md bg-muted/60 p-4 text-sm text-muted-foreground">
                          No safety gaps flagged.
                        </div>
                      )
                    ) : null}

                    {reviewPanelTab === "validation" ? (
                      validationIssues.length ? (
                        <div className="grid gap-2 lg:grid-cols-2">
                          {validationIssues.map((issue, index) => (
                            <div
                              className={`rounded-md border p-3 text-sm ${
                                issue.severity === "warning"
                                  ? "border-rose-200 bg-rose-50 text-rose-900"
                                  : "border-blue-100 bg-blue-50 text-blue-800"
                              }`}
                              key={`${issue.code}-${issue.section}-${index}`}
                            >
                              <div className="flex items-start gap-2">
                                <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                                <div>
                                  <p className="font-medium capitalize">{issue.section}</p>
                                  <p>{issue.message}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-md bg-muted/60 p-4 text-sm text-muted-foreground">
                          No unsupported claims flagged.
                        </div>
                      )
                    ) : null}

                    {reviewPanelTab === "icd" ? (
                      icdSuggestions.length ? (
                        <div className="space-y-3">
                          {icdSuggestionsMayBeOutdated ? (
                            <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                              <div className="flex gap-2">
                                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                                <span>
                                  Assessment or Plan changed after ICD suggestions were
                                  generated. Refresh codes if clinical meaning changed.
                                </span>
                              </div>
                              <Button
                                className="w-full border-amber-300 bg-white text-amber-900 hover:bg-amber-100 sm:w-auto"
                                disabled={icdRegenerationState === "loading"}
                                onClick={handleRegenerateIcdSuggestions}
                                type="button"
                                variant="outline"
                              >
                                {icdRegenerationState === "loading" ? (
                                  <Loader2 aria-hidden="true" className="animate-spin" />
                                ) : (
                                  <ClipboardList aria-hidden="true" />
                                )}
                                {icdRegenerationState === "loading"
                                  ? "Refreshing ICD..."
                                  : "Refresh ICD suggestions"}
                              </Button>
                              {icdRegenerationError ? (
                                <p className="text-xs text-destructive">
                                  {icdRegenerationError}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="grid gap-3 lg:grid-cols-2">
                            {icdSuggestions.map((suggestion) => (
                              <div
                                className="rounded-md border border-slate-200 bg-white p-4 text-sm"
                                key={`${suggestion.code}-${suggestion.label}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-slate-950">
                                      {suggestion.code} — {suggestion.label}
                                    </p>
                                    <p className="mt-1 text-muted-foreground">
                                      {suggestion.reason}
                                    </p>
                                  </div>
                                  <Badge className="shrink-0 border-slate-200 bg-slate-50 text-slate-700">
                                    {suggestion.confidence}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Coding suggestions are advisory and require physician/billing
                            review.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-md bg-muted/60 p-4 text-sm text-muted-foreground">
                          No ICD suggestions generated.
                        </div>
                      )
                    ) : null}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Generate a SOAP draft first to see safety checks, validation, and ICD
                    suggestions here.
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-[1440px] space-y-2">
          {showAgentStatus ? (
            <div
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                soapState === "loading"
                  ? "border-blue-200 bg-blue-50"
                  : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  soapState === "loading"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {soapState === "loading" ? (
                  <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="size-3.5" />
                )}
              </div>
              <p className="min-w-0 flex-1 truncate text-xs font-medium">
                {soapState === "loading"
                  ? `${currentAgentStep.label}...`
                  : "Context gathered — SOAP draft ready"}
              </p>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Button
              disabled={!audioBlob || transcriptionState === "loading"}
              onClick={handleTranscribe}
              size="sm"
              type="button"
              variant={workspaceTab === "transcript" ? "default" : "outline"}
            >
              {transcriptionState === "loading" ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <FileText aria-hidden="true" />
              )}
              {transcriptionState === "loading" ? "Transcribing..." : "Transcribe"}
            </Button>
            <Button
              disabled={
                soapState === "loading" || !transcript.trim() || !selectedPatient
              }
              onClick={handleGenerateSoap}
              size="sm"
              type="button"
              variant={workspaceTab === "soap" ? "default" : "outline"}
            >
              {soapState === "loading" ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <Sparkles aria-hidden="true" />
              )}
              {soapState === "loading" ? "Generating..." : "Generate SOAP"}
            </Button>
            <Button
              disabled={
                soapState === "loading" ||
                !Object.values(soapNote).some((value) => value.trim())
              }
              onClick={markReviewed}
              size="sm"
              type="button"
              variant={workspaceTab === "review" ? "default" : "outline"}
            >
              <ClipboardCheck aria-hidden="true" />
              Mark reviewed
            </Button>
            <Button
              disabled={
                saveState === "loading" ||
                (reviewState !== "reviewed" && reviewState !== "ready-to-save")
              }
              onClick={prepareSave}
              size="sm"
              type="button"
            >
              {saveState === "loading" ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <Save aria-hidden="true" />
              )}
              {saveState === "loading" ? "Saving..." : "Save note"}
            </Button>
          </div>

          {transcriptionError ? (
            <p className="text-xs text-destructive">{transcriptionError}</p>
          ) : null}
          {reviewError ? (
            <p
              className={`text-xs ${
                reviewState === "ready-to-save" ? "text-blue-700" : "text-destructive"
              }`}
            >
              {reviewError}
            </p>
          ) : null}
          {saveError ? (
            <p className="text-xs text-destructive">{saveError}</p>
          ) : null}
        </div>
      </footer>

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
