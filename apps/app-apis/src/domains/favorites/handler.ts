import { FavoritesQuerySchema } from "@app-apis/domains/favorites/schemas";
import { listFavorites } from "@app-apis/domains/favorites/service";
import { createDomainHandler } from "@app-apis/lib/createDomainHandler";
import { NextRequest } from "next/server";

const parseFavoritesRequest = (request: NextRequest) => {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  return FavoritesQuerySchema.parse(params);
};

export const GET = createDomainHandler({
  domain: "favorites",
  method: "GET",
  parse: parseFavoritesRequest,
  execute: (context, input) => listFavorites(context, input),
});
