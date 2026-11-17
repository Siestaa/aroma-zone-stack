import { api } from "./api";

const settingsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    fxRate: builder.query<number, void>({
      query: () => "/fx-rate",
      transformResponse: (response: { rate: number }) => response.rate,
    }),
    // Flat per-order service fee ("феям-помощницам") — charged to and
    // prepaid by the customer along with the items (CheckoutForm.tsx adds
    // it into the displayed total). Distinct from CDEK courier delivery,
    // which is paid separately, straight to the courier on receipt.
    helperFee: builder.query<number, void>({
      query: () => "/helper-fee",
      transformResponse: (response: { rub: number }) => response.rub,
    }),
    // Checkout's required consent-checkbox text + inline link — admin-
    // editable (api/src/services/settingsService.ts's getCheckoutTermsContent),
    // read by CheckoutForm.tsx.
    checkoutTerms: builder.query<{ text: string; linkText: string; linkUrl: string }, void>({
      query: () => "/checkout-terms",
    }),
  }),
});

export const { useFxRateQuery, useHelperFeeQuery, useCheckoutTermsQuery } = settingsApi;
