import { type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { createPublicKey } from "node:crypto";
import {
  exchangeAuthorizationCodeService,
  getOAuthClientService,
  registerOAuthClientService,
  signinService,
  signupService,
  userInfoService,
} from "./services.js";
import ApiError from "../../common/utils/ApiError.js";
import ApiResponse from "../../common/utils/ApiResponse.js";
import {
  oAuthClientRegister,
  tokenExchange,
  userLogin,
  userSignup,
} from "./validate.js";
import { type AuthenticatedRequest } from "./middleware.js";

const publicDir = path.resolve(process.cwd(), "public");

const getRequestValue = (value: unknown) => {
  // Step 1: Check whether the incoming value is already a string.
  // Step 2: If it is, return it as-is.
  // Step 3: If the value is an array, read the first item when it is a string.
  // Step 4: If neither case matches, return undefined.
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
};

const getBody = (req: Request) =>
  req.body && typeof req.body === "object"
    ? (req.body as Record<string, unknown>)
    : {};

const getAuthorizationPayload = (req: Request) => {
  // Step 1: Read the request body in a safe object form.
  // Step 2: Look for clientId in camelCase, snake_case, or query parameters.
  // Step 3: Look for redirectUri in camelCase, snake_case, or query parameters.
  // Step 4: Look for state in the body or query parameters.
  // Step 5: Return the normalized authorization payload.
  const body = getBody(req);

  return {
    clientId:
      getRequestValue(body.clientId) ??
      getRequestValue(body.client_id) ??
      getRequestValue(req.query.client_id),
    redirectUri:
      getRequestValue(body.redirectUri) ??
      getRequestValue(body.redirect_uri) ??
      getRequestValue(req.query.redirect_uri),
    state: getRequestValue(body.state) ?? getRequestValue(req.query.state),
  };
};

const sendPublicPage = (res: Response, fileName: string) => {
  // Step 1: Resolve the requested file path from the public directory.
  // Step 2: Send that file as an HTML response.
  res.sendFile(path.resolve(publicDir, fileName));
};

export const registerClientPage = (_: Request, res: Response) => {
  // Step 1: Ignore the request object because this route only serves a static page.
  // Step 2: Send the client registration page.
  sendPublicPage(res, "client-register.html");
};

export const signupPage = async (req: Request, res: Response) => {
  // Step 1: Extract OAuth-related values from the request.
  // Step 2: If a clientId exists, validate the OAuth client and redirect URI.
  // Step 3: Send the signup page to the browser.
  const { clientId, redirectUri } = getAuthorizationPayload(req);

  if (clientId) {
    await getOAuthClientService(clientId, redirectUri);
  }

  sendPublicPage(res, "signup.html");
};

export const signinPage = async (req: Request, res: Response) => {
  // Step 1: Extract OAuth-related values from the request.
  // Step 2: If a clientId exists, validate the OAuth client and redirect URI.
  // Step 3: Send the signin page to the browser.
  const { clientId, redirectUri } = getAuthorizationPayload(req);

  if (clientId) {
    await getOAuthClientService(clientId, redirectUri);
  }

  sendPublicPage(res, "signin.html");
};

export const registerOAuthClient = async (req: Request, res: Response) => {
  // Step 1: Validate the incoming request body against the OAuth client schema.
  // Step 2: If validation fails, log the error and throw a 400 ApiError.
  // Step 3: Extract the validated application fields.
  // Step 4: Call the service that creates the OAuth client.
  // Step 5: Return a 201 response with the created client.
  const result = await oAuthClientRegister.safeParseAsync(req.body);

  if (!result.success) {
    console.log(result.error);
    throw new ApiError(400, "Validation Error");
  }

  const { applicationName, applicationUrl, contactEmail, redirectUrl } =
    result.data;
  const response = await registerOAuthClientService(
    applicationName,
    contactEmail,
    applicationUrl,
    redirectUrl,
  );

  return new ApiResponse(
    res,
    201,
    "OAuth client registered successfully",
    response,
  );
};

export const signup = async (req: Request, res: Response) => {
  // Step 1: Merge the raw body with OAuth authorization data.
  // Step 2: Validate the merged payload against the signup schema.
  // Step 3: If validation fails, log the error and throw a 400 ApiError.
  // Step 4: Extract user credentials and OAuth context.
  // Step 5: Call the signup service.
  // Step 6: Return a 201 response with the authorization-code result.
  const payload = {
    ...req.body,
    ...getAuthorizationPayload(req),
  };
  const result = await userSignup.safeParseAsync(payload);

  if (!result.success) {
    console.log(result.error);
    throw new ApiError(400, "Validation Error");
  }

  const { clientId, email, name, password, redirectUri, state } = result.data;
  const response = await signupService(email, name, password, {
    clientId,
    redirectUri,
    state,
  });

  // Ensure the response always contains a client-visible redirect URL.
  // If the service did not produce `redirectTo` (defensive), fall back
  // to the local sign-in page and preserve original query string.
  const qs = Object.keys(req.query || {}).length
    ? `?${new URLSearchParams(req.query as Record<string, string>).toString()}`
    : "";
  const safeResponse = {
    ...response,
    redirectTo: response?.redirectTo ?? `/api/auth/signin${qs}`,
  };

  return new ApiResponse(res, 201, "User created successfully", safeResponse);
};

export const signin = async (req: Request, res: Response) => {
  // Step 1: Merge the raw body with OAuth authorization data.
  // Step 2: Validate the merged payload against the signin schema.
  // Step 3: If validation fails, log the error and throw a 400 ApiError.
  // Step 4: Extract user credentials and OAuth context.
  // Step 5: Call the signin service.
  // Step 6: If the service does not return a result, throw a 401 ApiError.
  // Step 7: Return a 200 response with the authorization-code result.
  const payload = {
    ...req.body,
    ...getAuthorizationPayload(req),
  };
  const result = await userLogin.safeParseAsync(payload);

  if (!result.success) {
    console.log(result.error);
    throw new ApiError(400, "Validation Error");
  }

  const { clientId, email, password, redirectUri, state } = result.data;
  const response = await signinService(email, password, {
    clientId,
    redirectUri,
    state,
  });

  if (!response) {
    throw new ApiError(401, "User Login failed");
  }

  return new ApiResponse(
    res,
    200,
    "Authorization code generated successfully",
    response,
  );
};

export const token = async (req: Request, res: Response) => {
  // Step 1: Read and normalize the request body.
  // Step 2: Normalize clientId, clientSecret, and redirectUri from camelCase or snake_case.
  // Step 3: Validate the payload against the token exchange schema.
  // Step 4: If validation fails, log the error and throw a 400 ApiError.
  // Step 5: Extract code and client credentials from the validated payload.
  // Step 6: Call the authorization code exchange service.
  // Step 7: Return a 200 response with generated tokens.
  const body = getBody(req);
  const payload = {
    ...body,
    clientId: getRequestValue(body.clientId) ?? getRequestValue(body.client_id),
    clientSecret:
      getRequestValue(body.clientSecret) ?? getRequestValue(body.client_secret),
    redirectUri:
      getRequestValue(body.redirectUri) ?? getRequestValue(body.redirect_uri),
  };
  const result = await tokenExchange.safeParseAsync(payload);

  if (!result.success) {
    console.log(result.error);
    throw new ApiError(400, "Validation Error");
  }

  const { clientId, clientSecret, code, redirectUri } = result.data;
  const response = await exchangeAuthorizationCodeService(
    code,
    clientId,
    clientSecret,
    redirectUri,
  );

  return new ApiResponse(res, 200, "Tokens generated successfully", response);
};

export const userinfo = async (req: AuthenticatedRequest, res: Response) => {
  // Step 1: Read the authenticated user id from the request.
  // Step 2: If the user id is missing, throw a 401 ApiError.
  // Step 3: Call the user info service with the user id.
  // Step 4: Return a 200 response with the sanitized user profile.
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(401, "Invalid access token");
  }

  const response = await userInfoService(userId);
  return new ApiResponse(res, 200, "User fetched successfully", response);
};

export const certs = (_: Request, res: Response) => {
  // Step 1: Read the RSA public key from disk.
  // Step 2: Convert the PEM key into JWK format.
  // Step 3: Build the JWKS response with signing metadata.
  // Step 4: Return the public key set as JSON.
  const publicKey = fs.readFileSync(
    path.resolve(process.cwd(), "cert", "public.pem"),
    "utf8",
  );
  const jwk = createPublicKey(publicKey).export({
    format: "jwk",
  }) as JsonWebKey;

  return res.status(200).json({
    keys: [
      {
        ...jwk,
        use: "sig",
        alg: "RS256",
        kid: "auth-service-rs256",
      },
    ],
  });
};

export const openIdConfig = (req: Request, res: Response) => {
  // Step 1: Build the base URL from the current request.
  // Step 2: Compose the OpenID discovery document endpoints.
  // Step 3: Declare the supported response types, grant types, and token auth method.
  // Step 4: Return the discovery document as JSON.
  const baseURL = `${req.protocol}://${req.get("host") ?? "localhost:8000"}`;
  res.status(200).json({
    issuer: baseURL,
    authorization_endpoint: `${baseURL}/api/auth/signin`,
    token_endpoint: `${baseURL}/api/auth/token`,
    userinfo_endpoint: `${baseURL}/api/auth/userinfo`,
    jwks_uri: `${baseURL}/api/auth/certs`,
    registration_endpoint: `${baseURL}/client/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
  });
};
