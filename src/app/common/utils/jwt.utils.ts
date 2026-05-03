import { eq } from "drizzle-orm"
import { db } from "../../../db/config.js"
import { users } from "../../../db/schema.js"
import ApiError from "./ApiError.js"
import jwt, { type SignOptions } from "jsonwebtoken"
import fs from "node:fs"
import path from "node:path"

const privateKeyPath = path.resolve(process.cwd(), "cert", "private.pem")

const getPrivateKey = () => {
    // Step 1: Try to read the private key file from disk.
    // Step 2: Return the key content as utf8 when successful.
    // Step 3: If reading fails, throw a 500 ApiError.
    try {
        return fs.readFileSync(privateKeyPath, "utf8")
    } catch {
        throw new ApiError(500, "Private key is not defined")
    }
}

export const generateTokens = async (userId: number) => {
    // Step 1: Query the user record by user id.
    // Step 2: If the user does not exist, throw a 404 ApiError.
    // Step 3: Load the private signing key.
    // Step 4: Read access and refresh token expiry values from environment variables.
    // Step 5: Sign the access token with user id, email, and name using RS256.
    // Step 6: Sign the refresh token with user id using RS256.
    // Step 7: Persist the new refresh token in the database for this user.
    // Step 8: Return both generated tokens.
    // Step 9: If any unexpected error occurs, wrap it in a 500 ApiError.
    try {
        const user = await db.select().from(users).where(eq(users.id, userId))

        if (!user || user.length === 0) {
            throw new ApiError(404, "User not found")
        }

        const currentUser = user[0]!
        const privateKey = getPrivateKey()

        const accessExpiry = process.env.ACCESS_TOKEN_EXPIRY ?? "15m"
        const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY ?? "7d"

        const accessToken = jwt.sign(
            {
                id: currentUser.id,
                email: currentUser.email,
                name: currentUser.name
            },
            privateKey,
            {
                algorithm: "RS256",
                expiresIn: accessExpiry
            } as SignOptions
        )

        const refreshToken = jwt.sign(
            {
                id: currentUser.id
            },
            privateKey,
            {
                algorithm: "RS256",
                expiresIn: refreshExpiry
            } as SignOptions
        )

        await db
            .update(users)
            .set({ refreshToken })
            .where(eq(users.id, userId))

        return { accessToken, refreshToken }

    } catch (error: unknown) {
        console.error(error)

        if (error instanceof ApiError) {
            throw error
        }

        throw new ApiError(
            500,
            "Something went wrong while generating tokens"
        )
    }
}
