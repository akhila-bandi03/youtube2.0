import React, { useState } from "react";

/**
 * OtpModal — A proper UI modal for OTP verification.
 * Replaces the browser prompt() with a styled dialog.
 *
 * Props:
 *  message   — Security notice text shown to user
 *  onVerify  — Callback(otpCode: string) called when user submits
 *  onCancel  — Callback called when user dismisses
 */
export default function OtpModal({ message, onVerify, onCancel }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onVerify(trimmed);
    } catch (err) {
      setError(err?.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Full-screen backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white text-center">
          <div className="text-3xl mb-2">🔐</div>
          <h2 className="text-lg font-bold">Security Verification Required</h2>
          <p className="text-xs text-violet-200 mt-1">Login from a new location or device detected</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center leading-relaxed">
            {message || "A 6-digit security code has been sent to your registered email address."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="otp-input"
                className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider"
              >
                Enter Verification Code
              </label>
              <input
                id="otp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="• • • • • •"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError("");
                }}
                autoFocus
                className="w-full text-center text-2xl font-mono tracking-[0.5em] border-2 border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
              {error && (
                <p className="text-red-500 text-xs mt-1.5 text-center font-medium">{error}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 text-sm font-semibold border-2 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying...
                  </>
                ) : (
                  "Verify & Login"
                )}
              </button>
            </div>
          </form>

          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            Code expires in <span className="font-semibold text-orange-500">5 minutes</span>.
            Check your spam folder if you don't see the email.
          </p>
        </div>
      </div>
    </div>
  );
}
