import { z } from "zod"

const authClientFields = {
    // Step 1: Define the OAuth client id as a required UUID string.
    // Step 2: Define redirectUri as an optional valid URL string.
    // Step 3: Define state as an optional string capped at 2048 characters.
    clientId: z.string().uuid(),
    redirectUri: z.string().url().optional(),
    state: z.string().max(2048).optional()
}

export const userSignup = z.object({
    // Step 1: Require the user's name with a length between 5 and 100.
    // Step 2: Require a valid email address up to 322 characters.
    // Step 3: Require a password length between 5 and 64.
    // Step 4: Merge shared OAuth client fields into the signup payload.
    name: z.string().min(5).max(100),
    email: z.string().email().max(322),
    password: z.string().min(5).max(64),
    ...authClientFields
});

export const userLogin = z.object({
    // Step 1: Require a valid email address up to 322 characters.
    // Step 2: Require a password length between 5 and 64.
    // Step 3: Merge shared OAuth client fields into the login payload.
    email: z.string().email().max(322),
    password: z.string().min(5).max(64),
    ...authClientFields
})


export const oAuthClientRegister = z.object({
    // Step 1: Require applicationName with a length between 3 and 255.
    // Step 2: Require contactEmail up to 322 characters.
    // Step 3: Require applicationUrl.
    // Step 4: Require redirectUrl.
    applicationName: z.string().min(3).max(255),
    contactEmail: z.string().max(322),
    applicationUrl: z.string(),
    redirectUrl: z.string()
})

export const tokenExchange = z.object({
    // Step 1: Require an authorization code string.
    // Step 2: Require the OAuth client id string.
    // Step 3: Require the OAuth client secret string.
    // Step 4: Accept an optional redirect URI string.
    code: z.string(),
    clientId: z.string(),
    clientSecret: z.string(),
    redirectUri: z.string().optional()
})
