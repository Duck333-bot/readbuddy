/** A direct page link is intentional navigation, not a request to resume saved progress. */
export function shouldOfferResumeRecap(search: string, hasRecap: boolean) {
  return hasRecap && !new URLSearchParams(search).has("page");
}
