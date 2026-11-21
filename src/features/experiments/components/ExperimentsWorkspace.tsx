"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format, startOfDay } from "date-fns";
import { FlaskConical, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { EmptyState, PageHeader } from "@/components/nx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  deriveExperimentStatus,
  EXPERIMENT_METRICS,
  EXPERIMENT_STATUS_LABEL,
  experimentFormSchema,
  type ExperimentFormValues,
} from "@/features/experiments/experimentUtils";
import { analyzeExperiment } from "@/lib/insights";
import {
  EXPERIMENT_TEMPLATES,
  applyExperimentTemplate,
} from "@/features/experiments/experimentTemplates";
import type { Experiment, InsightInput, ISODate } from "@/types/domain";

export interface ExperimentsWorkspaceProps {
  experiments: Experiment[];
  insightInput: InsightInput;
  todayISO: ISODate;
  onCreateExperiment: (
    values: Omit<Experiment, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onUpdateExperiment: (
    id: string,
    patch: Partial<Omit<Experiment, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<void>;
  onDeleteExperiment: (id: string) => Promise<void>;
}

function formatExperimentMean(metric: Experiment["metric"], mean: number | null): string {
  if (mean === null) return "—";
  if (metric === "reactionTime") return `${Math.round(mean)} ms`;
  if (metric === "memorySpan") return `${mean} items`;
  return `${mean}/5`;
}

function defaultFormValues(): ExperimentFormValues {
  const today = startOfDay(new Date());
  return {
    title: "",
    hypothesis: "",
    changeDescription: "",
    metric: "concentration",
    baselineStart: format(today, "yyyy-MM-dd"),
    baselineEnd: format(addDays(today, 6), "yyyy-MM-dd"),
    interventionStart: format(addDays(today, 7), "yyyy-MM-dd"),
    interventionEnd: format(addDays(today, 13), "yyyy-MM-dd"),
    reflection: "",
  };
}

export function ExperimentsWorkspace({
  experiments,
  insightInput,
  todayISO,
  onCreateExperiment,
  onUpdateExperiment,
  onDeleteExperiment,
}: ExperimentsWorkspaceProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Experiment | null>(null);
  const [reflectionDrafts, setReflectionDrafts] = useState<Record<string, string>>({});

  const form = useForm<ExperimentFormValues>({
    resolver: zodResolver(experimentFormSchema),
    defaultValues: defaultFormValues(),
  });

  const sortedExperiments = useMemo(
    () => [...experiments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [experiments],
  );

  const openCreate = () => {
    setEditing(null);
    form.reset(defaultFormValues());
    setDialogOpen(true);
  };

  const openEdit = (exp: Experiment) => {
    setEditing(exp);
    form.reset({
      title: exp.title,
      hypothesis: exp.hypothesis,
      changeDescription: exp.changeDescription,
      metric: exp.metric,
      baselineStart: exp.baselineStart,
      baselineEnd: exp.baselineEnd,
      interventionStart: exp.interventionStart,
      interventionEnd: exp.interventionEnd,
      reflection: exp.reflection ?? "",
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: ExperimentFormValues) => {
    const parsed = experimentFormSchema.parse(values);
    const derivedStatus = deriveExperimentStatus(parsed, todayISO);
    const payload = {
      title: parsed.title,
      hypothesis: parsed.hypothesis,
      changeDescription: parsed.changeDescription,
      metric: parsed.metric,
      baselineStart: parsed.baselineStart,
      baselineEnd: parsed.baselineEnd,
      interventionStart: parsed.interventionStart,
      interventionEnd: parsed.interventionEnd,
      status: derivedStatus,
      reflection: parsed.reflection?.trim() || undefined,
    };

    if (editing) {
      await onUpdateExperiment(editing.id, payload);
      toast.success(`Updated experiment "${parsed.title}".`);
    } else {
      await onCreateExperiment(payload);
      toast.success(`Created experiment "${parsed.title}".`);
    }
    setDialogOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Experiment Lab"
        description="Compare a baseline window against an intervention window on one self-rated metric."
        actions={
          <Button
            type="button"
            onClick={openCreate}
            className="gap-1.5 rounded-control bg-violet text-white hover:bg-violet/90"
          >
            <Plus className="size-4" aria-hidden />
            New experiment
          </Button>
        }
      />

      {sortedExperiments.length === 0 ? (
        <EmptyState
          icon={<FlaskConical />}
          title="No personal experiments yet"
          description="Write a hypothesis, choose a metric and two date windows, and review the comparison once both windows accumulate logs."
          action={
            <Button
              type="button"
              onClick={openCreate}
              className="rounded-control bg-violet text-white hover:bg-violet/90"
            >
              Create your first experiment
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {sortedExperiments.map((exp) => {
            const status = deriveExperimentStatus(exp, todayISO);
            const result = analyzeExperiment({ ...exp, status }, insightInput);
            const metricLabel =
              EXPERIMENT_METRICS.find((m) => m.value === exp.metric)?.label ?? exp.metric;
            const reflectionValue = reflectionDrafts[exp.id] ?? exp.reflection ?? "";

            return (
              <Card
                key={exp.id}
                className="space-y-5 rounded-card border border-border bg-surface p-5 shadow-none sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-cyan/40 bg-cyan/10 font-mono text-[11px] uppercase tracking-[0.12em] text-cyan"
                      >
                        {EXPERIMENT_STATUS_LABEL[status]}
                      </Badge>
                      <span className="font-mono text-caption text-muted-foreground">
                        {metricLabel}
                      </span>
                    </div>
                    <h2 className="text-section font-medium text-foreground">{exp.title}</h2>
                    <p className="text-body text-muted-foreground">{exp.hypothesis}</p>
                    <p className="text-caption text-muted-foreground">
                      Change: {exp.changeDescription}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Edit experiment ${exp.title}`}
                      onClick={() => openEdit(exp)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete experiment ${exp.title}`}
                      onClick={async () => {
                        await onDeleteExperiment(exp.id);
                        toast.success(`Deleted "${exp.title}".`);
                      }}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
                    </Button>
                  </div>
                </div>

                {/* Window comparison */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-control border border-border bg-surface-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-caption uppercase tracking-[0.12em] text-muted-foreground">
                        Baseline
                      </span>
                      <span className="font-mono text-caption text-muted-foreground tabular-nums">
                        {exp.baselineStart} → {exp.baselineEnd}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-title font-medium text-foreground tabular-nums">
                      {formatExperimentMean(exp.metric, result.baseline.mean)}
                    </p>
                    <p className="text-caption text-muted-foreground tabular-nums">
                      Sample size: {result.baseline.n}{" "}
                      {result.baseline.n === 1 ? "day" : "days"}
                    </p>
                  </div>

                  <div className="rounded-control border border-border bg-surface-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-caption uppercase tracking-[0.12em] text-cyan">
                        Intervention
                      </span>
                      <span className="font-mono text-caption text-muted-foreground tabular-nums">
                        {exp.interventionStart} → {exp.interventionEnd}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-title font-medium text-foreground tabular-nums">
                      {formatExperimentMean(exp.metric, result.intervention.mean)}
                    </p>
                    <p className="text-caption text-muted-foreground tabular-nums">
                      Sample size: {result.intervention.n}{" "}
                      {result.intervention.n === 1 ? "day" : "days"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-body text-foreground">{result.summary}</p>
                  {result.effectSizeNote ? (
                    <p className="text-caption text-muted-foreground">{result.effectSizeNote}</p>
                  ) : null}
                </div>

                {/* Mandatory causation caveat */}
                <div className="flex items-start gap-2 rounded-control border border-border bg-background/60 p-3">
                  <Info className="mt-0.5 size-4 shrink-0 text-cyan" aria-hidden />
                  <div className="space-y-1 text-caption text-muted-foreground">
                    {result.caveats.map((caveat, i) => (
                      <p key={i}>{caveat}</p>
                    ))}
                  </div>
                </div>

                {/* Closing reflection */}
                <div className="space-y-2 border-t border-border pt-4">
                  <Label htmlFor={`reflection-${exp.id}`}>Closing reflection</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Textarea
                      id={`reflection-${exp.id}`}
                      rows={2}
                      placeholder="What felt realistic, what else shifted, and would you keep this change?"
                      value={reflectionValue}
                      onChange={(e) =>
                        setReflectionDrafts((prev) => ({
                          ...prev,
                          [exp.id]: e.target.value,
                        }))
                      }
                      className="flex-1 rounded-control border-border bg-surface-2"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        await onUpdateExperiment(exp.id, {
                          reflection: reflectionValue.trim() || undefined,
                          status,
                        });
                        toast.success("Saved reflection.");
                      }}
                      className="self-end rounded-control sm:self-start"
                    >
                      Save reflection
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto border-border bg-surface sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit experiment" : "New personal experiment"}</DialogTitle>
            <DialogDescription>
              Status is derived automatically from your baseline and intervention dates.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {!editing ? (
              <section aria-labelledby="exp-templates" className="space-y-2 rounded-control border border-border bg-surface-2 p-3">
                <h3 id="exp-templates" className="text-caption font-medium text-foreground">
                  Start from a template
                </h3>
                {EXPERIMENT_TEMPLATES.map((template) => (
                  <div key={template.id} className="space-y-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => form.reset(applyExperimentTemplate(template, todayISO))}
                      className="h-auto min-h-8 w-full whitespace-normal rounded-control px-2.5 py-1.5 text-left text-caption"
                    >
                      {template.label}
                    </Button>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">{template.summary}</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">{template.caveat}</p>
                  </div>
                ))}
              </section>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="exp-title">Title</Label>
              <Input
                id="exp-title"
                placeholder="e.g. Does a steadier bedtime change how focused I feel?"
                {...form.register("title")}
                className="rounded-control border-border bg-surface-2"
              />
              {form.formState.errors.title ? (
                <p role="alert" className="text-caption text-danger">
                  {form.formState.errors.title.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exp-hypothesis">Hypothesis</Label>
              <Textarea
                id="exp-hypothesis"
                rows={2}
                placeholder="What do you expect might coincide with this change?"
                {...form.register("hypothesis")}
                className="rounded-control border-border bg-surface-2"
              />
              {form.formState.errors.hypothesis ? (
                <p role="alert" className="text-caption text-danger">
                  {form.formState.errors.hypothesis.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exp-change">Change description</Label>
              <Input
                id="exp-change"
                placeholder="e.g. Keep bedtime within a 30-minute window"
                {...form.register("changeDescription")}
                className="rounded-control border-border bg-surface-2"
              />
              {form.formState.errors.changeDescription ? (
                <p role="alert" className="text-caption text-danger">
                  {form.formState.errors.changeDescription.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exp-metric">Tracked metric</Label>
              <Controller
                control={form.control}
                name="metric"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="exp-metric"
                      className="w-full rounded-control border-border bg-surface-2"
                    >
                      <SelectValue placeholder="Choose metric" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPERIMENT_METRICS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="exp-b-start">Baseline start</Label>
                <Input
                  id="exp-b-start"
                  type="date"
                  {...form.register("baselineStart")}
                  className="rounded-control border-border bg-surface-2 font-mono"
                />
                {form.formState.errors.baselineStart ? (
                  <p role="alert" className="text-caption text-danger">
                    {form.formState.errors.baselineStart.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exp-b-end">Baseline end</Label>
                <Input
                  id="exp-b-end"
                  type="date"
                  {...form.register("baselineEnd")}
                  className="rounded-control border-border bg-surface-2 font-mono"
                />
                {form.formState.errors.baselineEnd ? (
                  <p role="alert" className="text-caption text-danger">
                    {form.formState.errors.baselineEnd.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exp-i-start">Intervention start</Label>
                <Input
                  id="exp-i-start"
                  type="date"
                  {...form.register("interventionStart")}
                  className="rounded-control border-border bg-surface-2 font-mono"
                />
                {form.formState.errors.interventionStart ? (
                  <p role="alert" className="text-caption text-danger">
                    {form.formState.errors.interventionStart.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exp-i-end">Intervention end</Label>
                <Input
                  id="exp-i-end"
                  type="date"
                  {...form.register("interventionEnd")}
                  className="rounded-control border-border bg-surface-2 font-mono"
                />
                {form.formState.errors.interventionEnd ? (
                  <p role="alert" className="text-caption text-danger">
                    {form.formState.errors.interventionEnd.message}
                  </p>
                ) : null}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="rounded-control"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="rounded-control bg-violet text-white hover:bg-violet/90"
              >
                {editing ? "Save changes" : "Create experiment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ExperimentsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-8 w-52 rounded-[6px]" />
        <Skeleton className="h-4 w-96 max-w-full rounded-[4px]" />
      </div>
      <Skeleton className="h-72 rounded-card" />
    </div>
  );
}
