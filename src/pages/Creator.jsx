import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Heart,
  Image as ImageIcon,
  Music2,
  Stars,
  Palette,
  Save,
  Eye,
  Link as LinkIcon,
} from "lucide-react";
import { defaultConfig } from "../data/defaultConfig";
import { loadConfig, saveConfig, clearConfig } from "../lib/storage";
import { encodeConfig } from "../lib/share";
const palettes = [
  { id: "rose", label: "Rose Mist" },
  { id: "lavender", label: "Lavender Moon" },
  { id: "peach", label: "Peach Glow" },
];
const unlockOptions = [
  { id: "scroll", label: "Scroll to Reveal" },
  { id: "time", label: "Time Delay" },
  { id: "click", label: "Heart Clicks" },
];
/* * Makes sure an imported/old config always has * all of the fields this component expects. */ const normalizeConfig =
  (input) => {
    const source = input || {};
    const defaults = defaultConfig || {};
    return {
      ...defaults,
      ...source,
      creatorName: source.creatorName ?? defaults.creatorName ?? "",
      partnerName: source.partnerName ?? defaults.partnerName ?? "",
      anniversaryDate: source.anniversaryDate ?? defaults.anniversaryDate ?? "",
      photos: Array.isArray(source.photos)
        ? source.photos.map((photo) => ({
            src: photo?.src ?? "",
            caption: photo?.caption ?? "",
          }))
        : Array.isArray(defaults.photos)
          ? defaults.photos.map((photo) => ({
              src: photo?.src ?? "",
              caption: photo?.caption ?? "",
            }))
          : [],
      music: {
        ...(defaults.music || {}),
        ...(source.music || {}),
        source: source.music?.source ?? defaults.music?.source ?? "",
        volume:
          typeof source.music?.volume === "number"
            ? source.music.volume
            : typeof defaults.music?.volume === "number"
              ? defaults.music.volume
              : 0.5,
      },
      shortLetter: source.shortLetter ?? defaults.shortLetter ?? "",
      longLetter: source.longLetter ?? defaults.longLetter ?? "",
      letterMode: source.letterMode ?? defaults.letterMode ?? "short",
      timeline: Array.isArray(source.timeline)
        ? source.timeline.map((item) => ({
            title: item?.title ?? "",
            date: item?.date ?? "",
            emoji: item?.emoji ?? "✨",
            description: item?.description ?? "",
          }))
        : Array.isArray(defaults.timeline)
          ? defaults.timeline.map((item) => ({
              title: item?.title ?? "",
              date: item?.date ?? "",
              emoji: item?.emoji ?? "✨",
              description: item?.description ?? "",
            }))
          : [],
      surprise: {
        ...(defaults.surprise || {}),
        ...(source.surprise || {}),
        unlock:
          source.surprise?.unlock ?? defaults.surprise?.unlock ?? "scroll",
        delaySeconds:
          typeof source.surprise?.delaySeconds === "number"
            ? source.surprise.delaySeconds
            : typeof defaults.surprise?.delaySeconds === "number"
              ? defaults.surprise.delaySeconds
              : 10,
        clickCount:
          typeof source.surprise?.clickCount === "number"
            ? source.surprise.clickCount
            : typeof defaults.surprise?.clickCount === "number"
              ? defaults.surprise.clickCount
              : 5,
      },
      theme: {
        ...(defaults.theme || {}),
        ...(source.theme || {}),
        palette: source.theme?.palette ?? defaults.theme?.palette ?? "rose",
      },
    };
  };
export default function Creator() {
  const navigate = useNavigate();
  const initial = useMemo(() => {
    const saved = loadConfig();
    return normalizeConfig(saved);
  }, []);
  const [config, setConfig] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [cloudName, setCloudName] = useState(
    () => localStorage.getItem("cloudinary-cloud") ?? "degstwskz",
  );
  const [uploadPreset, setUploadPreset] = useState(
    () => localStorage.getItem("cloudinary-preset") ?? "AnniversarySp",
  );
  const [uploading, setUploading] = useState(false);
  const hasEmbeddedAudio = config.music?.source?.startsWith("data:") ?? false;
  const hasEmbeddedImages = config.photos.some((photo) =>
    photo?.src?.startsWith("data:"),
  );
  const updateField = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };
  const updateNested = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      [field]: { ...(prev[field] || {}), ...value },
    }));
  };
  const optimizeImage = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => {
        img.onload = () => {
          const maxSize = 1600;
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas is not supported."));
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const optimized = canvas.toDataURL("image/jpeg", 0.82);
          resolve(optimized);
        };
        img.onerror = () => reject(new Error("Could not load image."));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error("Could not read image."));
      reader.readAsDataURL(file);
    });
  };
  const handleFileUpload = async (file, onLoad, kind = "file") => {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      alert("Please keep files under 12MB for smooth loading.");
      return;
    }
    if (kind === "image") {
      try {
        const optimized = await optimizeImage(file);
        onLoad(optimized);
      } catch (error) {
        console.error("Image optimization failed:", error);
        alert("Could not process that image.");
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onLoad(reader.result);
    };
    reader.onerror = () => {
      alert("Could not read that file.");
    };
    reader.readAsDataURL(file);
  };
  const uploadToCloudinary = async (file, resourceType = "image") => {
    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary cloud name and upload preset are required.");
    }
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", uploadPreset);
    const url =
      `https://api.cloudinary.com/v1_1/` +
      `${cloudName}/${resourceType}/upload`;
    const response = await fetch(url, { method: "POST", body: form });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Cloudinary error:", errorText);
      throw new Error("Cloudinary upload failed.");
    }
    const data = await response.json();
    return data.secure_url || data.url || "";
  };
  const handleCloudUpload = async (file, onLoad, resourceType = "image") => {
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadToCloudinary(file, resourceType);
      if (url) {
        onLoad(url);
      }
    } catch (error) {
      console.error(error);
      alert(
        "Upload failed. Check your Cloudinary cloud name and upload preset.",
      );
    } finally {
      setUploading(false);
    }
  };
  const handlePhotoUpload = async (file, index) => {
    if (!file) return;
    /* * If Cloudinary is configured, upload directly there. * This prevents us from unnecessarily creating a huge * base64 data URL first. */ if (
      cloudName &&
      uploadPreset
    ) {
      await handleCloudUpload(
        file,
        (src) => updatePhoto(index, { src }),
        "image",
      );
      return;
    }
    /* * Otherwise fall back to a local optimized image. */ await handleFileUpload(
      file,
      (src) => updatePhoto(index, { src }),
      "image",
    );
  };
  const handleAudioUpload = async (file) => {
    if (!file) return;
    if (cloudName && uploadPreset) {
      await handleCloudUpload(
        file,
        (src) => updateNested("music", { source: src }),
        "video",
      );
      return;
    }
    await handleFileUpload(file, (src) =>
      updateNested("music", { source: src }),
    );
  };
  const handleTimelineChange = (index, patch) => {
    setConfig((prev) => {
      const timeline = [...prev.timeline];
      timeline[index] = { ...timeline[index], ...patch };
      return { ...prev, timeline };
    });
  };
  const addTimelineItem = () => {
    setConfig((prev) => ({
      ...prev,
      timeline: [
        ...prev.timeline,
        {
          title: "New Memory",
          date: new Date().toISOString().slice(0, 10),
          emoji: "✨",
          description: "A new little chapter.",
        },
      ],
    }));
  };
  const removeTimelineItem = (index) => {
    setConfig((prev) => ({
      ...prev,
      timeline: prev.timeline.filter((_, i) => i !== index),
    }));
  };
  const movePhoto = (from, to) => {
    setConfig((prev) => {
      const photos = [...prev.photos];
      const [item] = photos.splice(from, 1);
      photos.splice(to, 0, item);
      return { ...prev, photos };
    });
  };
  const updatePhoto = (index, patch) => {
    setConfig((prev) => {
      const photos = [...prev.photos];
      photos[index] = { ...photos[index], ...patch };
      return { ...prev, photos };
    });
  };
  const addPhotoSlot = () => {
    setConfig((prev) => ({
      ...prev,
      photos: [...prev.photos, { src: "", caption: "" }],
    }));
  };
  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "anniversary-gift.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const handleImportJson = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const normalized = normalizeConfig(parsed);
        setConfig(normalized);
        saveConfig(normalized);
      } catch (error) {
        console.error(error);
        alert("Invalid JSON file.");
      }
    };
    reader.onerror = () => {
      alert("Could not read JSON file.");
    };
    reader.readAsText(file);
  };
  const saveAndPreview = () => {
    setSaving(true);
    saveConfig(config);
    setTimeout(() => {
      setSaving(false);
      navigate("/anniversary");
    }, 400);
  };
  const handleShareLink = async () => {
    if (uploading) {
      setShareMessage("Uploads are still running. Please wait a moment.");
      setTimeout(() => setShareMessage(""), 3500);
      return;
    }
    if (hasEmbeddedImages || hasEmbeddedAudio) {
      setShareMessage(
        "Share link is too long. Use hosted media (Cloudinary) and try again.",
      );
      setTimeout(() => setShareMessage(""), 3500);
      return;
    }
    const encoded = encodeConfig(config);
    if (!encoded) {
      setShareMessage("Could not create share link.");
      setTimeout(() => setShareMessage(""), 3500);
      return;
    }
    const url = `${window.location.origin}/anniversary?data=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage("Share link copied. Send it to your partner.");
    } catch (error) {
      console.error("Failed to copy:", error);
      setShareMessage("Copy failed. Try copying the URL from the address bar.");
    }
    setTimeout(() => setShareMessage(""), 3500);
  };
  const updateCloudName = (value) => {
    setCloudName(value);
    localStorage.setItem("cloudinary-cloud", value);
  };
  const updateUploadPreset = (value) => {
    setUploadPreset(value);
    localStorage.setItem("cloudinary-preset", value);
  };
  const handleReset = () => {
    clearConfig();
    /* * Create a fresh copy instead of sharing the same * object reference as defaultConfig. */ setConfig(
      normalizeConfig(defaultConfig),
    );
  };
  return (
    <div className="min-h-screen px-6 py-12 sm:px-10 lg:px-16">
      {" "}
      <div className="mx-auto max-w-6xl">
        {" "}
        {/* HEADER */}{" "}
        <header className="mb-10 flex flex-col gap-4">
          {" "}
          <div className="flex items-center gap-3 text-rose-500">
            {" "}
            <Sparkles className="h-6 w-6" />{" "}
            <span className="text-sm uppercase tracking-[0.4em]">
              {" "}
              Creator Mode{" "}
            </span>{" "}
          </div>{" "}
          <h1 className="font-display text-4xl sm:text-5xl">
            {" "}
            Create Your Anniversary Memory{" "}
          </h1>{" "}
          <p className="max-w-2xl text-lg text-slate-600">
            {" "}
            Fill these moments with love. We will turn them into magic.{" "}
          </p>{" "}
        </header>{" "}
        <section className="glass rounded-3xl p-8">
          {" "}
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
            {" "}
            {/* LEFT COLUMN */}{" "}
            <div className="space-y-6">
              {" "}
              {/* NAMES */}{" "}
              <div className="flex items-center gap-3">
                {" "}
                <Heart className="h-5 w-5 text-rose-400" />{" "}
                <h2 className="font-display text-2xl"> Names </h2>{" "}
              </div>{" "}
              <div className="grid gap-4 sm:grid-cols-2">
                {" "}
                <div>
                  {" "}
                  <label className="text-sm font-medium text-slate-600">
                    {" "}
                    Your name{" "}
                  </label>{" "}
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3"
                    value={config.creatorName}
                    placeholder="Romeo"
                    onFocus={(event) => event.target.select()}
                    onChange={(event) =>
                      updateField("creatorName", event.target.value)
                    }
                  />{" "}
                </div>{" "}
                <div>
                  {" "}
                  <label className="text-sm font-medium text-slate-600">
                    {" "}
                    Partner name{" "}
                  </label>{" "}
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3"
                    value={config.partnerName}
                    placeholder="Juliet"
                    onFocus={(event) => event.target.select()}
                    onChange={(event) =>
                      updateField("partnerName", event.target.value)
                    }
                  />{" "}
                </div>{" "}
              </div>{" "}
              <div className="rounded-2xl bg-white/60 p-4 text-center">
                {" "}
                <span className="text-lg font-semibold">
                  {" "}
                  {config.creatorName || "You"} ❤️{" "}
                  {config.partnerName || "Your Love"}{" "}
                </span>{" "}
              </div>{" "}
              {/* DATE */}{" "}
              <div>
                {" "}
                <label className="text-sm font-medium text-slate-600">
                  {" "}
                  Anniversary date{" "}
                </label>{" "}
                <input
                  type="date"
                  className="mt-2 w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3"
                  value={config.anniversaryDate}
                  onChange={(event) =>
                    updateField("anniversaryDate", event.target.value)
                  }
                />{" "}
              </div>{" "}
              {/* PHOTOS */}{" "}
              <div className="flex items-center gap-3">
                {" "}
                <ImageIcon className="h-5 w-5 text-rose-400" />{" "}
                <h2 className="font-display text-2xl"> Photos </h2>{" "}
              </div>{" "}
              <div className="space-y-4">
                {" "}
                {config.photos.map((photo, index) => (
                  <div
                    key={`photo-${index}`}
                    className="rounded-2xl border border-white/70 bg-white/70 p-4"
                  >
                    {" "}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {" "}
                      <span className="text-sm font-medium text-slate-500">
                        {" "}
                        Memory {index + 1}{" "}
                      </span>{" "}
                      <div className="flex gap-2">
                        {" "}
                        <button
                          type="button"
                          className="rounded-full border border-white/70 px-3 py-1 text-xs"
                          onClick={() =>
                            index > 0 && movePhoto(index, index - 1)
                          }
                        >
                          {" "}
                          Up{" "}
                        </button>{" "}
                        <button
                          type="button"
                          className="rounded-full border border-white/70 px-3 py-1 text-xs"
                          onClick={() =>
                            index < config.photos.length - 1 &&
                            movePhoto(index, index + 1)
                          }
                        >
                          {" "}
                          Down{" "}
                        </button>{" "}
                      </div>{" "}
                    </div>{" "}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {" "}
                      <input
                        placeholder="Paste image URL"
                        className="w-full rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm"
                        value={photo.src}
                        onChange={(event) =>
                          updatePhoto(index, { src: event.target.value })
                        }
                      />{" "}
                      <input
                        placeholder="Caption"
                        className="w-full rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm"
                        value={photo.caption}
                        onChange={(event) =>
                          updatePhoto(index, { caption: event.target.value })
                        }
                      />{" "}
                    </div>{" "}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {" "}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          handlePhotoUpload(file, index);
                          event.target.value = "";
                        }}
                      />{" "}
                      {photo.src ? (
                        <img
                          src={photo.src}
                          alt={`Memory ${index + 1}`}
                          className="h-16 w-16 rounded-xl object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/60 text-xs text-slate-400">
                          {" "}
                          Preview{" "}
                        </div>
                      )}{" "}
                    </div>{" "}
                  </div>
                ))}{" "}
                <button
                  type="button"
                  className="rounded-full border border-white/70 px-4 py-2 text-sm"
                  onClick={addPhotoSlot}
                >
                  {" "}
                  Add another photo{" "}
                </button>{" "}
                <p className="text-xs text-slate-500">
                  {" "}
                  Tip: for share links, use hosted image URLs. Large embedded
                  images make the link too long.{" "}
                </p>{" "}
                {hasEmbeddedImages && (
                  <p className="text-xs text-rose-500">
                    {" "}
                    Some photos are stored directly in this browser. Upload them
                    to Cloudinary for sharing.{" "}
                  </p>
                )}{" "}
              </div>{" "}
              {/* MUSIC */}{" "}
              <div className="flex items-center gap-3">
                {" "}
                <Music2 className="h-5 w-5 text-rose-400" />{" "}
                <h2 className="font-display text-2xl"> Music </h2>{" "}
              </div>{" "}
              <div className="space-y-3">
                {" "}
                <input
                  placeholder="Paste an audio URL or upload a file"
                  className="w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3"
                  value={config.music.source}
                  onChange={(event) =>
                    updateNested("music", { source: event.target.value })
                  }
                />{" "}
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    handleAudioUpload(file);
                    event.target.value = "";
                  }}
                />{" "}
                <p className="text-xs text-slate-500">
                  {" "}
                  For sharing, use a hosted audio URL. Cloudinary works well for
                  this.{" "}
                </p>{" "}
                {hasEmbeddedAudio && (
                  <p className="text-xs text-rose-500">
                    {" "}
                    Audio is currently embedded in this browser. Upload it to
                    Cloudinary for reliable sharing.{" "}
                  </p>
                )}{" "}
                <div className="flex items-center gap-3">
                  {" "}
                  <span className="text-sm text-slate-500"> Volume </span>{" "}
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.music.volume}
                    onChange={(event) =>
                      updateNested("music", {
                        volume: Number(event.target.value),
                      })
                    }
                  />{" "}
                </div>{" "}
              </div>{" "}
            </div>{" "}
            {/* RIGHT COLUMN */}{" "}
            <div className="space-y-6">
              {" "}
              {/* LOVE LETTER */}{" "}
              <div className="flex items-center gap-3">
                {" "}
                <Stars className="h-5 w-5 text-rose-400" />{" "}
                <h2 className="font-display text-2xl"> Love Letter </h2>{" "}
              </div>{" "}
              <div className="space-y-3">
                {" "}
                <textarea
                  rows={4}
                  placeholder="Short love letter..."
                  className="w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3"
                  value={config.shortLetter}
                  onChange={(event) =>
                    updateField("shortLetter", event.target.value)
                  }
                />{" "}
                <textarea
                  rows={8}
                  placeholder="Long love letter..."
                  className="w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3"
                  value={config.longLetter}
                  onChange={(event) =>
                    updateField("longLetter", event.target.value)
                  }
                />{" "}
                <div className="flex items-center gap-2 text-sm">
                  {" "}
                  <span>Default letter mode</span>{" "}
                  <select
                    className="rounded-full border border-white/70 bg-white/80 px-3 py-1"
                    value={config.letterMode}
                    onChange={(event) =>
                      updateField("letterMode", event.target.value)
                    }
                  >
                    {" "}
                    <option value="short"> Short </option>{" "}
                    <option value="long"> Long </option>{" "}
                  </select>{" "}
                </div>{" "}
              </div>{" "}
              {/* TIMELINE */}{" "}
              <div className="flex items-center gap-3">
                {" "}
                <Sparkles className="h-5 w-5 text-rose-400" />{" "}
                <h2 className="font-display text-2xl"> Timeline </h2>{" "}
              </div>{" "}
              <div className="space-y-3">
                {" "}
                {config.timeline.map((item, index) => (
                  <div
                    key={`timeline-${index}`}
                    className="rounded-2xl bg-white/70 p-4"
                  >
                    {" "}
                    <div className="flex flex-wrap items-center gap-3">
                      {" "}
                      <input
                        className="flex-1 rounded-full border border-white/60 bg-white/80 px-3 py-2"
                        value={item.title}
                        onChange={(event) =>
                          handleTimelineChange(index, {
                            title: event.target.value,
                          })
                        }
                      />{" "}
                      <input
                        type="date"
                        className="rounded-full border border-white/60 bg-white/80 px-3 py-2"
                        value={item.date}
                        onChange={(event) =>
                          handleTimelineChange(index, {
                            date: event.target.value,
                          })
                        }
                      />{" "}
                      <input
                        className="w-16 rounded-full border border-white/60 bg-white/80 px-3 py-2 text-center"
                        value={item.emoji}
                        onChange={(event) =>
                          handleTimelineChange(index, {
                            emoji: event.target.value,
                          })
                        }
                      />{" "}
                    </div>{" "}
                    <textarea
                      rows={2}
                      className="mt-3 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2"
                      value={item.description}
                      onChange={(event) =>
                        handleTimelineChange(index, {
                          description: event.target.value,
                        })
                      }
                    />{" "}
                    <button
                      type="button"
                      className="mt-2 text-xs text-rose-500"
                      onClick={() => removeTimelineItem(index)}
                    >
                      {" "}
                      Remove{" "}
                    </button>{" "}
                  </div>
                ))}{" "}
                <button
                  type="button"
                  className="rounded-full border border-white/70 px-4 py-2 text-sm"
                  onClick={addTimelineItem}
                >
                  {" "}
                  Add timeline moment{" "}
                </button>{" "}
              </div>{" "}
              {/* SURPRISE */}{" "}
              <div className="space-y-3">
                {" "}
                <select
                  className="w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3"
                  value={config.surprise.unlock}
                  onChange={(event) =>
                    updateNested("surprise", { unlock: event.target.value })
                  }
                >
                  {" "}
                  {unlockOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {" "}
                      {option.label}{" "}
                    </option>
                  ))}{" "}
                </select>{" "}
                {config.surprise.unlock === "time" && (
                  <input
                    type="number"
                    min="0"
                    className="w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3"
                    value={config.surprise.delaySeconds}
                    onChange={(event) =>
                      updateNested("surprise", {
                        delaySeconds: Number(event.target.value),
                      })
                    }
                    placeholder="Delay in seconds"
                  />
                )}{" "}
                {config.surprise.unlock === "click" && (
                  <input
                    type="number"
                    min="1"
                    className="w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3"
                    value={config.surprise.clickCount}
                    onChange={(event) =>
                      updateNested("surprise", {
                        clickCount: Number(event.target.value),
                      })
                    }
                    placeholder="Clicks to unlock"
                  />
                )}{" "}
              </div>{" "}
              {/* THEME */}{" "}
              <div className="flex items-center gap-3">
                {" "}
                <Palette className="h-5 w-5 text-rose-400" />{" "}
                <h2 className="font-display text-2xl"> Theme </h2>{" "}
              </div>{" "}
              <div className="grid gap-3 sm:grid-cols-3">
                {" "}
                {palettes.map((palette) => (
                  <button
                    type="button"
                    key={palette.id}
                    className={`rounded-2xl border px-4 py-3 text-sm ${config.theme.palette === palette.id ? "border-rose-400 bg-rose-50" : "border-white/70 bg-white/60"}`}
                    onClick={() =>
                      updateNested("theme", { palette: palette.id })
                    }
                  >
                    {" "}
                    {palette.label}{" "}
                  </button>
                ))}{" "}
              </div>{" "}
              {/* SHARING */}{" "}
              <div className="flex items-center gap-3">
                {" "}
                <LinkIcon className="h-5 w-5 text-rose-400" />{" "}
                <h2 className="font-display text-2xl"> Sharing </h2>{" "}
              </div>{" "}
              <div className="space-y-4 rounded-2xl bg-white/70 p-4">
                {" "}
                <p className="text-sm text-slate-600">
                  {" "}
                  Share links work for anyone. For reliable sharing, use hosted
                  media such as Cloudinary.{" "}
                </p>{" "}
                <div className="grid gap-3 sm:grid-cols-2">
                  {" "}
                  <div>
                    {" "}
                    <label className="text-xs font-medium text-slate-500">
                      {" "}
                      Cloudinary cloud name{" "}
                    </label>{" "}
                    <input
                      className="mt-2 w-full rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm"
                      value={cloudName}
                      onChange={(event) => updateCloudName(event.target.value)}
                      placeholder="your-cloud"
                    />{" "}
                  </div>{" "}
                  <div>
                    {" "}
                    <label className="text-xs font-medium text-slate-500">
                      {" "}
                      Upload preset{" "}
                    </label>{" "}
                    <input
                      className="mt-2 w-full rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm"
                      value={uploadPreset}
                      onChange={(event) =>
                        updateUploadPreset(event.target.value)
                      }
                      placeholder="your-preset"
                    />{" "}
                  </div>{" "}
                </div>{" "}
                <div className="flex flex-wrap gap-3">
                  {" "}
                  <button
                    type="button"
                    className="rounded-full border border-white/70 px-4 py-2 text-sm"
                    onClick={handleDownloadJson}
                  >
                    {" "}
                    Download gift JSON{" "}
                  </button>{" "}
                  <label className="cursor-pointer rounded-full border border-white/70 px-4 py-2 text-sm">
                    {" "}
                    Import gift JSON{" "}
                    <input
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(event) => {
                        handleImportJson(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />{" "}
                  </label>{" "}
                </div>{" "}
              </div>{" "}
            </div>{" "}
          </div>{" "}
          {/* BOTTOM ACTIONS */}{" "}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
            {" "}
            <div className="flex gap-3">
              {" "}
              <button
                type="button"
                className="rounded-full border border-white/70 px-4 py-2 text-sm"
                onClick={handleReset}
              >
                {" "}
                Reset{" "}
              </button>{" "}
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-white/70 px-4 py-2 text-sm"
                onClick={() => {
                  saveConfig(config);
                  setShareMessage("Draft saved.");
                  setTimeout(() => setShareMessage(""), 2500);
                }}
              >
                {" "}
                <Save className="h-4 w-4" /> Save draft{" "}
              </button>{" "}
            </div>{" "}
            <div className="flex flex-wrap gap-3">
              {" "}
              <button
                type="button"
                disabled={uploading}
                className="flex items-center gap-2 rounded-full border border-white/70 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleShareLink}
              >
                {" "}
                <LinkIcon className="h-4 w-4" />{" "}
                {uploading ? "Uploading..." : "Copy share link"}{" "}
              </button>{" "}
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-white/70 px-4 py-2 text-sm"
                onClick={() => navigate("/anniversary")}
              >
                {" "}
                <Eye className="h-4 w-4" /> Preview{" "}
              </button>{" "}
              <button
                type="button"
                disabled={saving || uploading}
                className="flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2 text-sm text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
                onClick={saveAndPreview}
              >
                {" "}
                <Heart className="h-4 w-4" />{" "}
                {saving ? "Saving..." : "Generate Anniversary Experience"}{" "}
              </button>{" "}
            </div>{" "}
          </div>{" "}
          {shareMessage && (
            <div className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-600">
              {" "}
              {shareMessage}{" "}
            </div>
          )}{" "}
        </section>{" "}
      </div>{" "}
    </div>
  );
}
