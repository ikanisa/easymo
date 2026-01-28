export type DraftFields = {
    type?: "buy" | "sell";
    category?: string;
    title?: string;
    description?: string;
    price_min?: number | null;
    price_max?: number | null;
    currency?: string;
    location_text?: string;
};

export type ListingDraftFields = {
    category?: string;
    title?: string;
    description?: string;
    price?: number | null;
    currency?: string;
    price_type?: "fixed" | "negotiable" | "range";
    price_min?: number | null;
    price_max?: number | null;
    location_text?: string;
    availability?: "unknown" | "in_stock" | "made_to_order" | "service_available";
};

export function derivePatchFromMessage(
    text: string,
    currentDraft?: Partial<DraftFields>,
): Partial<DraftFields> {
    const lower = text.toLowerCase();
    const patch: Partial<DraftFields> = {};

    if (/\b(sell|selling|offer)\b/.test(lower)) patch.type = "sell";
    if (/\b(buy|need|looking|searching)\b/.test(lower) && patch.type !== "sell")
        patch.type = "buy";

    const categories = [
        {
            name: "electronics",
            keywords: ["phone", "laptop", "smartphone", "computer", "tablet"],
        },
        {
            name: "mobility",
            keywords: ["bike", "motorcycle", "car", "scooter", "vehicle"],
        },
        { name: "furniture", keywords: ["sofa", "table", "chair", "furniture"] },
        {
            name: "services",
            keywords: ["repair", "installation", "service", "consult"],
        },
    ];

    if (!currentDraft?.category) {
        for (const candidate of categories) {
            if (candidate.keywords.some((word) => lower.includes(word))) {
                patch.category = candidate.name;
                break;
            }
        }
    }

    const locationMatch = text.match(
        /\b(in|around|near|at)\s+([A-Za-zÀ-ÿ\s]+)/i,
    );
    if (locationMatch) {
        patch.location_text = locationMatch[2].trim().replace(/[.,]$/, "");
    }

    const priceMatches = text
        .match(/\d{3,}(?:[\s,]*\d{3})*/g)
        ?.map((value) => Number(value.replace(/[\s,]/g, "")));
    if (priceMatches?.length) {
        const [first, second] = priceMatches;
        if (priceMatches.length === 1) {
            patch.price_min = first;
            patch.price_max = first;
        } else {
            patch.price_min = Math.min(first, second);
            patch.price_max = Math.max(first, second);
        }
    }

    if (!currentDraft?.description) {
        patch.description = text.trim();
    }

    if (!currentDraft?.title) {
        const snippet = text.split(/[.!?]/)[0].trim();
        patch.title = snippet.length > 50 ? `${snippet.slice(0, 47)}…` : snippet;
    }

    return patch;
}

export function deriveListingPatchFromMessage(
    text: string,
    currentDraft?: Partial<ListingDraftFields>,
): Partial<ListingDraftFields> {
    const lower = text.toLowerCase();
    const patch: Partial<ListingDraftFields> = {};

    const categories = [
        {
            name: "electronics",
            keywords: ["phone", "laptop", "smartphone", "computer", "tablet"],
        },
        {
            name: "mobility",
            keywords: ["bike", "motorcycle", "car", "scooter", "vehicle"],
        },
        {
            name: "home",
            keywords: ["sofa", "table", "chair", "furniture", "mattress"],
        },
        {
            name: "services",
            keywords: [
                "repair",
                "installation",
                "service",
                "consult",
                "plumber",
                "electrician",
            ],
        },
    ];

    if (!currentDraft?.category) {
        for (const candidate of categories) {
            if (candidate.keywords.some((word) => lower.includes(word))) {
                patch.category = candidate.name;
                break;
            }
        }
    }

    const locationMatch = text.match(
        /\b(in|around|near|at)\s+([A-Za-zÀ-ÿ\s]+)/i,
    );
    if (locationMatch) {
        patch.location_text = locationMatch[2].trim().replace(/[.,]$/, "");
    }

    if (/\b(negotiable|open to offers)\b/.test(lower)) {
        patch.price_type = "negotiable";
    }

    const priceMatches = text
        .match(/\d{3,}(?:[\s,]*\d{3})*/g)
        ?.map((value) => Number(value.replace(/[\s,]/g, "")));
    if (priceMatches?.length) {
        const [first, second] = priceMatches;
        if (
            priceMatches.length >= 2 &&
            Number.isFinite(first) &&
            Number.isFinite(second)
        ) {
            patch.price_type = "range";
            patch.price_min = Math.min(first, second);
            patch.price_max = Math.max(first, second);
        } else if (Number.isFinite(first)) {
            patch.price_type = patch.price_type ?? "fixed";
            patch.price = first;
            patch.price_min = null;
            patch.price_max = null;
        }
    }

    if (/\b(in stock|available now)\b/.test(lower))
        patch.availability = "in_stock";
    if (/\b(made to order|preorder|order)\b/.test(lower))
        patch.availability = "made_to_order";
    if (/\b(service available|available for work)\b/.test(lower))
        patch.availability = "service_available";

    if (!currentDraft?.description) {
        patch.description = text.trim();
    }

    if (!currentDraft?.title) {
        const snippet = text.split(/[.!?]/)[0].trim();
        patch.title = snippet.length > 60 ? `${snippet.slice(0, 57)}…` : snippet;
    }

    return patch;
}
