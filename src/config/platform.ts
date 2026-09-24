/**
 * Platform-level (not tenant) settings. The developer credit appears in the footer of every
 * store; set `developerCredit` to null for a client who needs a fully unbranded storefront.
 */
export type DeveloperCredit = {
  name: string
  nameUrl?: string
  company: string
  companyUrl?: string
}

export const developerCredit: DeveloperCredit | null = {
  name: "Shahrukh Kaleem",
  company: "Elevix Digital",
}
