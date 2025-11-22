"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import { shopsQueryKeys } from "@/lib/queries/shops";
import { createShop } from "@/lib/shops/shops-service";

export function ShopWizard() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [businessLocation, setBusinessLocation] = useState("");
  const [whatsappCatalogUrl, setWhatsappCatalogUrl] = useState("");
  const [openingHours, setOpeningHours] = useState("07:00 - 21:00");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const mutation = useMutation({
    mutationFn: createShop,
    onSuccess: () => {
      pushToast({
        title: "Shop added",
        description: "The catalogue will refresh with the new entry shortly.",
      });
      setName("");
      setPhone("");
      setDescription("");
      setTagsInput("");
      setBusinessLocation("");
      setWhatsappCatalogUrl("");
      setOpeningHours("07:00 - 21:00");
      setLat("");
      setLng("");
      queryClient.invalidateQueries({ queryKey: shopsQueryKeys.list() });
    },
    onError: (error: unknown) => {
      pushToast({
        title: "Unable to save shop",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "error",
      });
    },
  });

  const parsedTags = tagsInput
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const tags = parsedTags.slice(0, 5);
  const tagLimitExceeded = parsedTags.length > tags.length;

  const canSubmit =
    name.trim().length > 2 &&
    description.trim().length > 5 &&
    businessLocation.trim().length > 2 &&
    tags.length > 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit || mutation.isPending) return;
        const latNum = Number(lat);
        const lngNum = Number(lng);
        const hasCoordinates = Number.isFinite(latNum) && Number.isFinite(lngNum);

        mutation.mutate({
          name: name.trim(),
          phone: phone.trim() || undefined,
          description: description.trim(),
          businessLocation: businessLocation.trim(),
          tags,
          whatsappCatalogUrl: whatsappCatalogUrl.trim() || undefined,
          openingHours: openingHours.trim() || undefined,
          coordinates:
            lat && lng && hasCoordinates
              ? {
                  lat: latNum,
                  lng: lngNum,
                }
              : undefined,
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col text-sm font-medium text-[color:var(--color-foreground)]">
          Shop name
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nyamirambo Boutique"
            required
            className="mt-1"
          />
        </label>
        <label className="flex flex-col text-sm font-medium text-[color:var(--color-foreground)]">
          Contact phone
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+2507..."
            className="mt-1"
          />
        </label>
      </div>
      <label className="block text-sm font-medium text-[color:var(--color-foreground)]">
        Business description
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Vehicle parts, electronics repairs, beauty salon…"
          rows={3}
          className="mt-1"
        />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col text-sm font-medium text-[color:var(--color-foreground)]">
          Tags (comma separated, up to five)
          <Textarea
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            placeholder="vehicle, electronics, smart devices"
            rows={2}
            className="mt-1"
          />
          <span className="mt-1 text-xs font-normal text-[color:var(--color-muted)]">
            {tagLimitExceeded
              ? "Only the first five tags will be used."
              : "AI sourcing agents rely on these tags to match the right shop or service."}
          </span>
        </label>
        <label className="flex flex-col text-sm font-medium text-[color:var(--color-foreground)]">
          WhatsApp catalog URL
          <Input
            value={whatsappCatalogUrl}
            onChange={(event) => setWhatsappCatalogUrl(event.target.value)}
            placeholder="https://wa.me/c/..."
            className="mt-1"
          />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col text-sm font-medium text-[color:var(--color-foreground)]">
          Opening hours
          <Input
            value={openingHours}
            onChange={(event) => setOpeningHours(event.target.value)}
            placeholder="07:00 - 21:00"
            className="mt-1"
          />
        </label>
        <label className="flex flex-col text-sm font-medium text-[color:var(--color-foreground)]">
          Business location
          <Input
            value={businessLocation}
            onChange={(event) => setBusinessLocation(event.target.value)}
            placeholder="Kicukiro · KK 9 Ave"
            className="mt-1"
            required
          />
        </label>
        <label className="flex flex-col text-sm font-medium text-[color:var(--color-foreground)]">
          Latitude (optional)
          <Input
            value={lat}
            onChange={(event) => setLat(event.target.value)}
            placeholder="-1.95"
            className="mt-1"
          />
        </label>
        <label className="flex flex-col text-sm font-medium text-[color:var(--color-foreground)]">
          Longitude (optional)
          <Input
            value={lng}
            onChange={(event) => setLng(event.target.value)}
            placeholder="30.06"
            className="mt-1"
          />
        </label>
      </div>
      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={!canSubmit || mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Create entry"}
        </Button>
      </div>
    </form>
  );
}
