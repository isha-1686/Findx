import { useState, useRef } from "react";
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { MapPin, PackageSearch, SearchCheck, Upload, Sparkles, Image as ImageIcon, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthUser } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, type ItemType } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/report")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: search.type === "found" ? "found" : search.type === "lost" ? "lost" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Report an Item — Reunite" },
      {
        name: "description",
        content: "Post a lost or found item with photograph, category, and location for AI visual matching.",
      },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const navigate = useNavigate();
  const user = useAuthUser();
  const { type: initialType } = Route.useSearch();
  const [type, setType] = useState<ItemType>(initialType ?? "lost");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<string>("");
  const [contactInfo, setContactInfo] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aiPredicting, setAiPredicting] = useState(false);
  const [predictedCat, setPredictedCat] = useState<string | null>(null);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    // Run AI category prediction
    setAiPredicting(true);
    try {
      const pred = await api.ml.predictCategory(file);
      setPredictedCat(pred.predicted_category);
      setAiConfidence(pred.confidence);
      // Auto-set category if not manually chosen
      if (!category) {
        setCategory(pred.predicted_category);
      }
      toast.success(
        `AI detected: ${pred.predicted_category} (${(pred.confidence * 100).toFixed(1)}% confidence)`
      );
    } catch {
      // Non-fatal if model endpoint fails
    } finally {
      setAiPredicting(false);
    }
  }

  function removeImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setPredictedCat(null);
    setAiConfidence(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageFile) {
      toast.error("Please upload a photograph of the item for AI matching.");
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("location", location.trim());
      if (category) formData.append("category", category);
      if (contactInfo) formData.append("contact_info", contactInfo.trim());
      formData.append("image", imageFile);

      const res = await api.reports.create(formData);
      toast.success(
        type === "lost"
          ? "Lost report submitted! Checking AI matches..."
          : "Found item published! Owners can now be matched."
      );

      navigate({ to: "/items/$id", params: { id: res.item.id } });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to post report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">
        Report an <span className="text-gradient">item</span>
      </h1>
      <p className="mt-2 text-muted-foreground">
        Upload a clear photograph and details so our fine-tuned ResNet18 AI can find matches.
      </p>

      <form onSubmit={handleSubmit} className="glow-card mt-8 space-y-6 rounded-3xl p-7">
        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-3">
          <TypeOption
            active={type === "lost"}
            onClick={() => setType("lost")}
            icon={<SearchCheck className="h-5 w-5" />}
            label="I lost it"
            tone="lost"
          />
          <TypeOption
            active={type === "found"}
            onClick={() => setType("found")}
            icon={<PackageSearch className="h-5 w-5" />}
            label="I found it"
            tone="found"
          />
        </div>

        {/* Photo Upload Box with AI Detection */}
        <div className="space-y-2">
          <Label className="flex items-center justify-between">
            <span>Item Photograph * (Required for AI Visual Matching)</span>
            {aiPredicting && (
              <span className="flex items-center gap-1 text-xs text-primary-glow animate-pulse">
                <Sparkles className="h-3 w-3" /> Analyzing photo...
              </span>
            )}
          </Label>

          {imagePreview ? (
            <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-card p-3">
              <div className="relative h-56 w-full overflow-hidden rounded-xl bg-muted/30">
                <img
                  src={imagePreview}
                  alt="Item preview"
                  className="h-full w-full object-contain"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 rounded-full bg-background/80 p-1.5 text-foreground shadow-md backdrop-blur-sm hover:bg-destructive hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {predictedCat && (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-primary/10 px-3.5 py-2 text-xs font-medium text-primary-glow">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> AI Category: <strong>{predictedCat}</strong>
                  </span>
                  {aiConfidence !== null && (
                    <span>{(aiConfidence * 100).toFixed(1)}% confidence</span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/40 p-8 text-center transition hover:border-primary/60 hover:bg-card/70"
            >
              <div className="rounded-full bg-primary/10 p-3 text-primary-glow">
                <Upload className="h-6 w-6" />
              </div>
              <p className="mt-3 font-display text-sm font-semibold text-foreground">
                Click to upload a photo
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Supports JPG, PNG, WEBP (under 10 MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Item title *</Label>
          <Input
            id="title"
            required
            maxLength={120}
            placeholder={type === "lost" ? "e.g. Blue canvas backpack" : "e.g. Found black wireless earbuds"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            required
            maxLength={2000}
            rows={4}
            placeholder="Describe unique marks, zippers, color, brand, or contents to assist fine-grained matching..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location" className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary-glow" />
            Location *
          </Label>
          <Input
            id="location"
            required
            maxLength={200}
            placeholder={type === "lost" ? "Where you last saw it (e.g. Main Library 2nd floor)" : "Where you found it (e.g. Cafeteria table 4)"}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="rounded-xl"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Pick or let AI detect" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact">Contact info (Optional)</Label>
            <Input
              id="contact"
              maxLength={200}
              placeholder="Email, phone or desk number"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>

        <Button type="submit" variant="hero" size="lg" className="w-full rounded-full" disabled={busy}>
          {busy ? "Analyzing & Submitting..." : type === "lost" ? "Submit Lost Report & Run AI Search" : "Publish Found Item"}
        </Button>
      </form>
    </div>
  );
}

function TypeOption({
  active,
  onClick,
  icon,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone: "lost" | "found";
}) {
  const toneClass = tone === "lost" ? "text-lost" : "text-found";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-4 font-display text-base font-semibold transition ${
        active
          ? tone === "lost"
            ? "border-lost/60 bg-lost/10"
            : "border-found/60 bg-found/10"
          : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className={toneClass}>{icon}</span>
      {label}
    </button>
  );
}
