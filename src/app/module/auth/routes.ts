import { Router } from "express";
import {
    certs,
    registerClientPage,
    registerOAuthClient,
    signin,
    signinPage,
    signup,
    signupPage,
    token,
    userinfo
} from "./controller.js";
import { verifyAccessToken } from "./middleware.js";

const router: Router = Router();

router.get("/client/register", registerClientPage);
router.post("/client/register", registerOAuthClient);
router.get("/signup", signupPage);
router.post("/signup", signup);
router.get("/signin", signinPage);
router.post("/signin", signin);
router.post("/token", token);
router.get("/userinfo", verifyAccessToken, userinfo);
router.get("/certs", certs);

export default router;
