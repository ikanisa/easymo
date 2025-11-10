"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import { createShop } from "@/lib/shops/shops-service";
import { shopsQueryKeys } from "@/lib/queries/shops";

interface ShopWizardProps {
  defaultCategories?: string[];
}

export function ShopWizard({ defaultCategories = [] }: ShopWizardProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState(defaultCategories.join(", "));
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
      setCategories(defaultCategories.join(", "));
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
        variant: "destructive",
      });
    },
  });

  const parsedCategories = categories
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const canSubmit = name.trim().length > 2 && parsedCategories.length > 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit || mutation.isLoading) return;
        mutation.mutate({
          name: name.trim(),
          phone: phone.trim() || undefined,
          description: description.trim() || undefined,
          categories: parsedCategories,
          whatsappCatalogUrl: whatsappCatalogUrl.trim() || undefined,
          openingHours: openingHours.trim() || undefined,
          location:
            lat && lng
              ? {
                  lat: Number(lat),
                  lng: Number(lng),
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
        Description
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Merch assortment or speciality"
          rows={3}
          className="mt-1"
        />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col text-sm font-medium text-[color:var(--color-foreground)]">
          Categories (comma separated)
          <Textarea
            value={categories}
            onChange={(event) => setCategories(event.target.value)}
            placeholder="grocery, pharmacy"
            rows={2}
            className="mt-1"
          />
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
          Latitude
          <Input
            value={lat}
            onChange={(event) => setLat(event.target.value)}
            placeholder="-1.95"
            className="mt-1"
          />
        </label>
        <label className="flex flex-col text-sm font-medium text-[color:var(--color-foreground)]">
          Longitude
          <Input
            value={lng}
            onChange={(event) => setLng(event.target.value)}
            placeholder="30.06"
            className="mt-1"
          />
        </label>
      </div>
      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={!canSubmit || mutation.isLoading}>
          {mutation.isLoading ? "Saving…" : "Create shop"}
        </Button>
      </div>
    </form>
  );
}
