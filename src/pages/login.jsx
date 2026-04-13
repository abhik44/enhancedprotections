//
import { HiKey, HiOutlineUser } from "react-icons/hi";
import styles from "./LoginPage.module.css";
import Spinner from "../ui/Spinner";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";

// const ALLOWED_EMAIL = "testuser@gmail.com";
const ALLOWED_EMAIL = "admin@enhancedprotections.com";

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const auth = getAuth();
      const res = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = res.user;

      if (!user) throw new Error("Authentication returned no user.");

      if ((user.email || "").toLowerCase() !== ALLOWED_EMAIL.toLowerCase()) {
        await signOut(auth);
        toast.error("Unauthorized user");
        setLoading(false);
        return;
      }

      toast.success("Logged in");
      navigate("/app");
    } catch (err) {
      console.error("Firebase auth error:", err);
      const code = err?.code || "unknown";
      const message = err?.message || String(err);

      if (code === "auth/user-not-found") {
        toast.error("No user found with that email");
      } else if (code === "auth/wrong-password") {
        toast.error("Incorrect password");
      } else if (code === "auth/invalid-email") {
        toast.error("Invalid email address");
      } else if (code === "auth/invalid-credential") {
        toast.error("Invalid credential. Check sign-in method and credentials.");
      } else {
        toast.error(message);
      }

      setLoading(false);
    }
  }

  return (
    <div className={styles.loginBackground}>
      {loading && (
        <div className={styles.fullPageLoader}>
          <div className={styles.loaderBox}>
            <Spinner colorSpinner="text-danger" />
            <span>Logging in...</span>
          </div>
        </div>
      )}

      <div className={`${styles.loginBox} rounded-3 px-4 pb-4 pt-2`}>
        <div className="mb-3 text-center mt-2">
          <img src="./logo.png" alt="logo" className={styles.loginLogo} />
        </div>

        <h5 className="text-center mb-4">Admin Login</h5>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="emailInput" className="form-label fw-medium mb-2">
              Email
            </label>
            <div className={`d-flex border align-items-center ${styles.inputBox} px-2 rounded-2`}>
              <HiOutlineUser />
              <input id="emailInput" type="email" className="form-control border-0" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="passwordInput" className="form-label fw-medium mb-2">
              Password
            </label>
            <div className={`d-flex border align-items-center ${styles.inputBox} px-2 rounded-2`}>
              <HiKey />
              <input id="passwordInput" type="password" className="form-control border-0" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          <button type="submit" className="btn btn-danger custom-red-bg text-white fw-semibold mt-4 w-100 mb-3">
            LogIn
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
