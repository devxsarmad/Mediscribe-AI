"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Loader2, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listSavedNotes } from "@/lib/api";
import type { SavedNote } from "@/lib/api";
type SavedNotesState = "idle" | "loading" | "ready" | "error";
function formatSavedAt(value: string) {
  if (!value) {
    return "Timestamp pending";
  }
  return new Date(value).toLocaleString();
}

const soapSections: Array<{
  key: keyof SavedNote["soap"];
  label: string;
}> = [
  { key: "subjective", label: "Subjective" },
  { key: "objective", label: "Objective" },
  { key: "assessment", label: "Assessment" },
  { key: "plan", label: "Plan" },
];

export default function NotesPage() {
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [notesState, setNotesState] = useState<SavedNotesState>("idle");
  const [notesError, setNotesError] = useState("");
  useEffect(() => {
    void loadNotes();
  }, []);
  async function loadNotes() {
    setNotesState("loading");
    setNotesError("");

    try {
      const result = await listSavedNotes();
      setNotes(result.notes);
      setNotesState("ready");
    } catch (error) {
      setNotesState("error");
      setNotesError(
        error instanceof Error
          ? error.message
          : "Saved notes could not be loaded.",
      );
    }
  }
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 bg-background/80 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-blue-200 bg-blue-50 text-blue-800">
                Medical Scribe AI
              </Badge>
              <Badge className="border-slate-200 bg-white text-slate-600">
                Saved records
              </Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Saved clinical notes
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft aria-hidden="true" />
                Workspace
              </Link>
            </Button>
            <Button
              disabled={notesState === "loading"}
              onClick={() => void loadNotes()}
              type="button"
            >
              {notesState === "loading" ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <RefreshCcw aria-hidden="true" />
              )}
              Refresh
            </Button>
          </div>
        </header>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Recent notes</CardTitle>
            <Badge className="border-blue-200 bg-blue-50 text-blue-700">
              {notes.length} total
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {notesState === "error" ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <p className="font-semibold">Saved notes unavailable</p>
                <p className="mt-1">{notesError}</p>
              </div>
            ) : null}
            {notesState === "loading" ? (
              <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-5 text-sm text-muted-foreground">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Loading saved notes...
              </div>
            ) : null}
            {notesState !== "loading" && notesState !== "error" && notes.length === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
                No saved notes yet. Once a doctor reviews and saves a SOAP note,
                it will appear here.
              </div>
            ) : null}
            <div className="grid gap-3">
              {notes.map((note) => (
                <div className="rounded-md border bg-background p-4" key={note.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {note.patientContext.patientLabel} ·{" "}
                        {note.patientContext.visitType}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        MRN {note.patientContext.mrnLabel} · Saved{" "}
                        {formatSavedAt(note.savedAt)}
                      </p>
                    </div>
                    <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                      <FileText aria-hidden="true" className="mr-1 size-3" />
                      {note.status}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {soapSections.map((section) => (
                      <div className="rounded-md bg-muted/40 p-3" key={section.key}>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          {section.label}
                        </p>
                        <p className="mt-2 text-sm leading-6">
                          {note.soap[section.key] ||
                            `No ${section.label.toLowerCase()} content saved.`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
