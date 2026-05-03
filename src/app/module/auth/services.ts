import { eq } from "drizzle-orm";
import { db } from "../../../db/config.js";
import { oAuthClients, users } from "../../../db/schema.js";
import ApiError from "../../common/utils/ApiError.js"
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { generateTokens } from "../../common/utils/jwt.utils.js";

const sanitizeUser = (user: any) => {
    if (!user) return null

    const userObj = typeof user.toObject === "function" ? user.toObject() : { ...user }
    delete userObj.passwordHash
    delete userObj.emailToken
    delete userObj.passwordToken
    delete userObj.refreshToken
    return userObj
}

type AuthorizationCodeRecord = {
    clientId: string
    expiresAt: number
    redirectUri: string
    userId: number
}

type AuthorizationRequest = {
    clientId: string
    redirectUri: string | undefined
    state: string | undefined
}

const AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000
const authorizationCodes = new Map<string, AuthorizationCodeRecord>()

const getOAuthClientByClientId = async (clientId: string) => {
    const clients = await db.select().from(oAuthClients).where(eq(oAuthClients.clientId, clientId));

    if (clients.length < 1) {
        throw new ApiError(404, "OAuth client not found");
    }

    return clients[0]!;
}

const getValidatedRedirectUri = (registeredRedirectUri: string, redirectUri?: string) => {
    if (redirectUri && redirectUri !== registeredRedirectUri) {
        throw new ApiError(400, "Invalid redirect URI");
    }

    return redirectUri ?? registeredRedirectUri;
}

const buildRedirectUrl = (redirectUri: string, code: string, state?: string) => {
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set("code", code);

    if (state) {
        redirectUrl.searchParams.set("state", state);
    }

    return redirectUrl.toString();
}

const createAuthorizationCode = async ({
    clientId,
    redirectUri,
    state,
    userId
}: AuthorizationRequest & { userId: number }) => {
    const client = await getOAuthClientByClientId(clientId);
    const resolvedRedirectUri = getValidatedRedirectUri(client.redirectUrl, redirectUri);
    const code = randomUUID();

    authorizationCodes.set(code, {
        clientId: client.clientId,
        expiresAt: Date.now() + AUTHORIZATION_CODE_TTL_MS,
        redirectUri: resolvedRedirectUri,
        userId
    });

    return {
        clientId: client.clientId,
        code,
        expiresIn: Math.floor(AUTHORIZATION_CODE_TTL_MS / 1000),
        redirectTo: buildRedirectUrl(resolvedRedirectUri, code, state),
        redirectUri: resolvedRedirectUri,
        state
    };
}

export const getOAuthClientService = async (clientId: string, redirectUri?: string) => {
    const client = await getOAuthClientByClientId(clientId);

    return {
        client,
        redirectUri: getValidatedRedirectUri(client.redirectUrl, redirectUri)
    };
}

export const registerOAuthClientService = async (
    applicationName: string,
    contactEmail: string,
    applicationUrl: string,
    redirectUrl: string
) => {
    const clientId = randomUUID();
    const clientSecret = randomUUID();
    const client = await db.insert(oAuthClients).values({
        applicationName,
        applicationUrl,
        clientId,
        clientSecret,
        contactEmail,
        redirectUrl
    }).returning();

    if (client.length < 1) {
        throw new ApiError(500, "OAuth client registration failed");
    }

    return client[0]!;
}

export const signupService = async (
    email: string,
    name: string,
    password: string,
    authorizationRequest: AuthorizationRequest
) => {
    if (!email || !name || !password) {
        throw new ApiError(400, "Bad Request");
    }
    const existingUser = await db.select().from(users).where(eq(users.email, email))
    console.log(existingUser)
    if (existingUser.length > 0) {
        throw new ApiError(409, "User already exist");
    }
    const hashPassword = await bcrypt.hash(password, 10);
    const user = await db.insert(users).values({
        name,
        email,
        passwordHash: hashPassword
    }).returning();

    if (!user) {
        throw new ApiError(500, "User Registration Failed");
    }
    // Send email to the user so that they can verify there email

    return createAuthorizationCode({
        ...authorizationRequest,
        userId: user[0]!.id
    });
}

export const signinService = async (
    email: string,
    password: string,
    authorizationRequest: AuthorizationRequest
) => {
    if (!email || !password) {
        throw new ApiError(401, "Invalid Credential, Credential Required");
    }
    const user = await db.select().from(users).where(eq(users.email, email));
    if (user.length < 1) {
        throw new ApiError(409, "User Not Found");
    }
    if (!await bcrypt.compare(password, user[0]!.passwordHash)) {
        throw new ApiError(401, "Invalid Credential!");
    }
    return createAuthorizationCode({
        ...authorizationRequest,
        userId: user[0]!.id
    });
}

export const userInfoService = async (userId: number) => {
    const user = await db.select().from(users).where(eq(users.id, userId));

    if (user.length < 1) {
        throw new ApiError(404, "User Not Found");
    }

    return sanitizeUser(user[0]);
}

export const exchangeAuthorizationCodeService = async (
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri?: string
) => {
    const client = await getOAuthClientByClientId(clientId);

    if (client.clientSecret !== clientSecret) {
        throw new ApiError(401, "Invalid client credentials");
    }

    const authorizationCode = authorizationCodes.get(code);

    if (!authorizationCode) {
        throw new ApiError(400, "Invalid authorization code");
    }

    if (authorizationCode.expiresAt < Date.now()) {
        authorizationCodes.delete(code);
        throw new ApiError(400, "Authorization code expired");
    }

    const resolvedRedirectUri = getValidatedRedirectUri(client.redirectUrl, redirectUri);

    if (authorizationCode.clientId !== client.clientId || authorizationCode.redirectUri !== resolvedRedirectUri) {
        throw new ApiError(400, "Authorization code does not match client");
    }

    authorizationCodes.delete(code);

    const tokens = await generateTokens(authorizationCode.userId);
    const user = await userInfoService(authorizationCode.userId);

    return {
        ...tokens,
        tokenType: "Bearer",
        user
    };
}
