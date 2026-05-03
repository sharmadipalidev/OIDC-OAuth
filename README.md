# Authentication Flow

This project implements an OAuth/OIDC-style authentication flow from client registration to protected user access.

## 1. Controller Layer

The controller layer in `src/app/module/auth/controller.ts` is the HTTP entry point. It does not contain the core business logic itself. It mainly:

- reads request data
- validates input with Zod schemas from `src/app/module/auth/validate.ts`
- calls business logic in `src/app/module/auth/services.ts`
- returns structured responses or throws `ApiError`

The route map in `src/app/module/auth/routes.ts` defines the order of the public endpoints.

## 2. Client Registration

Client registration starts with `GET` and `POST /client/register`.

- `GET /client/register` serves the HTML page through `registerClientPage`
- `POST /client/register` goes to `registerOAuthClient`
- `registerOAuthClient` validates application data, then calls `registerOAuthClientService`
- `registerOAuthClientService` creates a new OAuth client with a client id and client secret, then stores it in the database

## 3. Sign Up or Sign In Page

Login or signup starts with `GET /signup` or `GET /signin`.

- `GET /signup` and `GET /signin` return the HTML pages
- Before serving those pages, the controller may check the `clientId` and `redirectUri` by calling `getOAuthClientService`
- This ensures the page already knows which OAuth client is requesting the flow

## 4. User Signup

User signup happens through `POST /signup`.

- `signup` merges the normal form body with OAuth values like `clientId`, `redirectUri`, and `state`
- It validates everything using `userSignup`
- Then it calls `signupService`
- `signupService` checks whether the user already exists, hashes the password, creates the user, and then creates an authorization code for that user
- The response includes redirect information so the client can continue the OAuth flow

## 5. User Signin

User signin happens through `POST /signin`.

- `signin` does the same payload merging and validation, but with `userLogin`
- Then it calls `signinService`
- `signinService` checks the email and password, and if valid, creates an authorization code
- If login fails, the controller throws `401`

## 6. Token Exchange

Token exchange happens through `POST /token`.

- `token` reads `code`, `clientId`, `clientSecret`, and `redirectUri`
- It validates them with `tokenExchange`
- Then it calls `exchangeAuthorizationCodeService`
- That service verifies the client secret, checks the authorization code, checks expiry, checks the redirect URI, deletes the code so it cannot be reused, generates tokens, and returns the token response plus user info

## 7. Protected User Info

Protected user info comes from `GET /userinfo`.

- This route uses `verifyAccessToken` from `src/app/module/auth/middleware.ts` before the controller runs
- The middleware reads the Bearer token from the `Authorization` header, verifies it with the public key, and stores the decoded user in `req.user`
- Then `userinfo` uses that user id and calls `userInfoService`
- `userInfoService` fetches the user and removes sensitive fields like `passwordHash` before returning it

## 8. Public Keys and OIDC Metadata

Public keys and OIDC metadata are exposed for integration.

- `certs` returns the JWKS document from the public key in `cert/public.pem`
- `openIdConfig` returns the OpenID discovery document, including authorization, token, userinfo, certs, and registration endpoints

## Big Picture

The whole app follows this flow:

1. Register a client
2. Sign up or sign in a user
3. Generate an authorization code
4. Exchange that code for tokens
5. Use the access token to call `userinfo`
6. Expose certs so tokens can be verified externally