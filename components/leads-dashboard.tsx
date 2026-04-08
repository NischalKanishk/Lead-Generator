"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CLIENT_TYPE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type ClientType,
  type GenerateApiType,
  type Lead,
  type LeadStatus,
} from "@/lib/types";

const PAGE_SIZE = 20;
const SCRAPE_QUERY_PRESETS: Record<"1" | "2" | "3", string[]> = {
  "1": [
    "head of people mumbai startup site:linkedin.com",
    "head of HR bangalore startup site:linkedin.com",
    "chief of staff mumbai startup site:linkedin.com",
    "chief of staff bangalore startup site:linkedin.com",
    "CEO founder mumbai startup 50 employees site:linkedin.com",
  ],
  "2": [
    "office manager mumbai company site:linkedin.com",
    "admin manager bangalore company site:linkedin.com",
    "operations manager mumbai mid-size company site:linkedin.com",
    "travel coordinator bangalore company site:linkedin.com",
    "executive assistant CEO mumbai site:linkedin.com",
  ],
  "3": [
    "placement coordinator engineering college mumbai contact",
    "dean student affairs bangalore university contact",
    "TPO engineering college pune contact",
    "student affairs coordinator mumbai college contact",
    "placement officer MBA institute bangalore",
  ],
};

function typeBadgeVariant(t: number): "orange" | "blue" | "green" {
  if (t === 1) return "orange";
  if (t === 2) return "blue";
  return "green";
}

function statusBadgeVariant(
  s: string
): "secondary" | "outline" | "default" | "muted" {
  switch (s) {
    case "new":
      return "secondary";
    case "contacted":
      return "outline";
    case "replied":
      return "default";
    case "qualified":
      return "default";
    case "unqualified":
      return "muted";
    default:
      return "secondary";
  }
}

function statusLabel(s: string): string {
  if (LEAD_STATUSES.includes(s as LeadStatus)) {
    return LEAD_STATUS_LABELS[s as LeadStatus];
  }
  return s;
}

const GENERATE_TABS: {
  id: string;
  label: string;
  apiType: GenerateApiType;
  field: keyof Pick<
    Lead,
    "generated_email" | "follow_up_1" | "follow_up_2" | "follow_up_3"
  >;
}[] = [
  {
    id: "initial",
    label: "Initial Email",
    apiType: "initial",
    field: "generated_email",
  },
  { id: "fu1", label: "Follow-up 1", apiType: "follow_up_1", field: "follow_up_1" },
  { id: "fu2", label: "Follow-up 2", apiType: "follow_up_2", field: "follow_up_2" },
  { id: "fu3", label: "Follow-up 3", apiType: "follow_up_3", field: "follow_up_3" },
];

export function LeadsDashboard() {
  const [clientType, setClientType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [cityInput, setCityInput] = useState("");
  const [debouncedCity, setDebouncedCity] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetLead, setSheetLead] = useState<Lead | null>(null);
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [generatingRowId, setGeneratingRowId] = useState<string | null>(null);

  const [scrapeClientType, setScrapeClientType] = useState<string>("1");
  const [scrapeQueries, setScrapeQueries] = useState("");
  const [scrapeSubmitting, setScrapeSubmitting] = useState(false);

  const [addForm, setAddForm] = useState({
    name: "",
    title: "",
    email: "",
    company_name: "",
    city: "",
    company_website: "",
    client_type: "1",
    notes: "",
  });
  const [addSubmitting, setAddSubmitting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCity(cityInput), 300);
    return () => clearTimeout(t);
  }, [cityInput]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [clientType, status, debouncedCity, debouncedSearch]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (clientType !== "all") params.set("client_type", clientType);
      if (status !== "all") params.set("status", status);
      if (debouncedCity) params.set("city", debouncedCity);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      const res = await fetch(`/api/leads?${params}`);
      if (!res.ok) throw new Error("Failed to load leads");
      const data = await res.json();
      setLeads(data.leads);
      setTotal(data.total);
    } catch {
      toast.error("Could not load leads");
      setLeads([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [clientType, status, debouncedCity, debouncedSearch, page]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    if (!selectedId || !sheetOpen) return;
    const fromPage = leads.find((l) => String(l.id) === selectedId);
    if (fromPage) setSheetLead(fromPage);
  }, [leads, selectedId, sheetOpen]);

  const openLead = (lead: Lead) => {
    setSelectedId(String(lead.id));
    setSheetLead(lead);
    setSheetOpen(true);
  };

  const patchLead = async (body: Record<string, unknown>) => {
    if (!selectedId) return;
    const res = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedId, ...body }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Save failed");
      return;
    }
    const updated = (await res.json()) as Lead;
    setLeads((prev) =>
      prev.map((l) => (String(l.id) === String(updated.id) ? updated : l))
    );
    setSheetLead((prev) =>
      prev && String(prev.id) === String(updated.id) ? updated : prev
    );
  };

  const generateForLead = async (leadId: string, type: GenerateApiType) => {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, type }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Generate failed");
      return;
    }
    if (data.lead) {
      const updated = data.lead as Lead;
      setLeads((prev) =>
        prev.map((l) => (String(l.id) === String(updated.id) ? updated : l))
      );
      setSheetLead((prev) =>
        prev && String(prev.id) === String(updated.id) ? updated : prev
      );
    } else {
      await fetchLeads();
    }
    toast.success("Content generated");
  };

  const handleRowGenerate = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setGeneratingRowId(String(lead.id));
    try {
      await generateForLead(String(lead.id), "initial");
    } finally {
      setGeneratingRowId(null);
    }
  };

  const copyText = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const submitScrape = async () => {
    setScrapeSubmitting(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_type: Number(scrapeClientType),
          queries: scrapeQueries,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Scrape request failed");
        return;
      }
      toast.success(`Scrape started — run ${data.runId}`);
      setScrapeOpen(false);
      setScrapeQueries("");
    } finally {
      setScrapeSubmitting(false);
    }
  };

  const submitAddLead = async () => {
    setAddSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name,
          title: addForm.title,
          email: addForm.email || null,
          company_name: addForm.company_name,
          city: addForm.city,
          company_website: addForm.company_website || null,
          client_type: Number(addForm.client_type),
          notes: addForm.notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Could not add lead");
        return;
      }
      toast.success("Lead added");
      setAddOpen(false);
      setAddForm({
        name: "",
        title: "",
        email: "",
        company_name: "",
        city: "",
        company_website: "",
        client_type: "1",
        notes: "",
      });
      await fetchLeads();
    } finally {
      setAddSubmitting(false);
    }
  };

  const clientTypeLabel = (t: number) =>
    CLIENT_TYPE_LABELS[t as ClientType] ?? `Type ${t}`;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-4 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            OneMoment Leads
          </h1>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Client type
            </p>
            <RadioGroup value={clientType} onValueChange={setClientType}>
              <div className="flex items-center space-x-2 py-1">
                <RadioGroupItem value="all" id="ct-all" />
                <Label htmlFor="ct-all" className="cursor-pointer font-normal">
                  All
                </Label>
              </div>
              {([1, 2, 3] as const).map((t) => (
                <div key={t} className="flex items-center space-x-2 py-1">
                  <RadioGroupItem value={String(t)} id={`ct-${t}`} />
                  <Label
                    htmlFor={`ct-${t}`}
                    className="cursor-pointer font-normal"
                  >
                    {CLIENT_TYPE_LABELS[t]} ({t})
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </p>
            <RadioGroup value={status} onValueChange={setStatus}>
              <div className="flex items-center space-x-2 py-1">
                <RadioGroupItem value="all" id="st-all" />
                <Label htmlFor="st-all" className="cursor-pointer font-normal">
                  All
                </Label>
              </div>
              {LEAD_STATUSES.map((s) => (
                <div key={s} className="flex items-center space-x-2 py-1">
                  <RadioGroupItem value={s} id={`st-${s}`} />
                  <Label
                    htmlFor={`st-${s}`}
                    className="cursor-pointer font-normal"
                  >
                    {LEAD_STATUS_LABELS[s]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label
              htmlFor="city-filter"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              City
            </Label>
            <Input
              id="city-filter"
              className="mt-2"
              placeholder="Filter by city..."
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2 border-t border-border p-4">
          <Button className="w-full" onClick={() => setScrapeOpen(true)}>
            Run Scraper
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setAddOpen(true)}
          >
            Add Lead
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-border bg-card px-6 py-3">
          <Input
            className="max-w-md"
            placeholder="Search name, title, company..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </span>
            ) : (
              <span>
                {total} lead{total === 1 ? "" : "s"}
              </span>
            )}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[5rem] text-center text-foreground">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <div className="relative flex-1 overflow-auto">
          {loading && leads.length === 0 ? (
            <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              Loading leads…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Name / Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No leads match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow
                      key={String(lead.id)}
                      className="cursor-pointer"
                      onClick={() => openLead(lead)}
                    >
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {lead.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {lead.title || "—"}
                        </div>
                      </TableCell>
                      <TableCell>{lead.company_name ?? "—"}</TableCell>
                      <TableCell>{lead.city ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={typeBadgeVariant(Number(lead.client_type))}>
                          {clientTypeLabel(Number(lead.client_type))}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(lead.status)}>
                          {statusLabel(lead.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lead.email ? (
                          <Check
                            className="h-5 w-5 text-emerald-600"
                            aria-label="Has email"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={generatingRowId === String(lead.id)}
                          onClick={(e) => handleRowGenerate(e, lead)}
                        >
                          {generatingRowId === String(lead.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Generate"
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
          {loading && leads.length > 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-start justify-center bg-background/40 pt-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </div>
      </main>

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) {
            setSelectedId(null);
            setSheetLead(null);
          }
        }}
      >
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
          {sheetLead && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="text-xl">{sheetLead.name}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {sheetLead.title}
                  {sheetLead.title && sheetLead.company_name ? " · " : ""}
                  {sheetLead.company_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {sheetLead.city ?? "—"}
                </p>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {sheetLead.linkedin_url ? (
                  <a
                    href={sheetLead.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {sheetLead.linkedin_url}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">No LinkedIn URL</p>
                )}

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={sheetLead.status}
                    onValueChange={(v) => {
                      void patchLead({ status: v });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        new Set<string>([...LEAD_STATUSES, sheetLead.status])
                      ).map((s) => (
                        <SelectItem key={s} value={s}>
                          {statusLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lead-notes">Notes</Label>
                  <Textarea
                    id="lead-notes"
                    key={String(sheetLead.id)}
                    defaultValue={sheetLead.notes ?? ""}
                    onBlur={(e) => {
                      const next = e.target.value;
                      if (next !== (sheetLead.notes ?? "")) {
                        void patchLead({ notes: next });
                      }
                    }}
                    rows={4}
                  />
                </div>

                <Tabs defaultValue="initial" className="w-full">
                  <TabsList className="flex h-auto w-full flex-wrap gap-1">
                    {GENERATE_TABS.map((tab) => (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="text-xs sm:text-sm"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {GENERATE_TABS.map((tab) => {
                    const content = sheetLead[tab.field] as string | null;
                    return (
                      <TabsContent
                        key={tab.id}
                        value={tab.id}
                        className="space-y-2"
                      >
                        {content ? (
                          <>
                            <Textarea
                              readOnly
                              className="min-h-[200px] resize-none font-mono text-sm"
                              value={content}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => copyText(content)}
                            >
                              <Copy className="h-4 w-4" />
                              Copy
                            </Button>
                          </>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              No content yet for this step.
                            </p>
                            <Button
                              type="button"
                              onClick={() =>
                                generateForLead(String(sheetLead.id), tab.apiType)
                              }
                            >
                              Generate
                            </Button>
                          </div>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={scrapeOpen} onOpenChange={setScrapeOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Run Scraper</DialogTitle>
            <DialogDescription>
              One search query per line. Requires Apify env vars; on success you
              will get a run id for the actor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Client type</Label>
              <Select
                value={scrapeClientType}
                onValueChange={(value) => {
                  const nextType = value as "1" | "2" | "3";
                  setScrapeClientType(nextType);
                  setScrapeQueries(SCRAPE_QUERY_PRESETS[nextType].join("\n"));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {([1, 2, 3] as const).map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {CLIENT_TYPE_LABELS[t]} ({t})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scrape-queries">Search queries</Label>
              <Textarea
                id="scrape-queries"
                rows={8}
                placeholder={`"head of people" "mumbai" startup site:linkedin.com\n"office manager" "bangalore" company site:linkedin.com\nengineering college mumbai contact`}
                value={scrapeQueries}
                onChange={(e) => setScrapeQueries(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScrapeOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={scrapeSubmitting}
              onClick={() => void submitScrape()}
            >
              {scrapeSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Lead</DialogTitle>
            <DialogDescription>
              Create a new lead. Name is required; other fields map to your
              Supabase `leads` table.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {(
              [
                ["name", "Name"],
                ["title", "Title"],
                ["email", "Email"],
                ["company_name", "Company name"],
                ["city", "Company city"],
                ["company_website", "Company website"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`add-${key}`}>{label}</Label>
                <Input
                  id={`add-${key}`}
                  value={addForm[key]}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label>Client type</Label>
              <Select
                value={addForm.client_type}
                onValueChange={(v) =>
                  setAddForm((f) => ({ ...f, client_type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {([1, 2, 3] as const).map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {CLIENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-notes">Notes</Label>
              <Textarea
                id="add-notes"
                rows={3}
                value={addForm.notes}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={addSubmitting || !addForm.name.trim()}
              onClick={() => void submitAddLead()}
            >
              {addSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
