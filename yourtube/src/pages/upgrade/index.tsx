import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, ShieldCheck, CreditCard, ChevronRight } from "lucide-react";
import axiosInstance from "@/lib/axiosinstance";
import { useUser } from "@/lib/AuthContext";
import Link from "next/link";

interface Plan {
  id: "free" | "bronze" | "silver" | "gold";
  name: string;
  price: number;
  downloads: string;
  features: string[];
  color: string;
  btnStyle: string;
}

export default function UpgradePage() {
  const { user, login } = useUser();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  // Robust Razorpay Script Loader
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && (window as any).Razorpay) {
        return resolve(true);
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  useEffect(() => {
    loadRazorpayScript();
  }, []);

  const plans: Plan[] = [
    {
      id: "free",
      name: "Free Plan",
      price: 0,
      downloads: "1 video per day",
      features: [
        "Standard stream quality",
        "Supported by ads",
        "Limited to 1 download per day",
        "No access to Premium videos"
      ],
      color: "border-slate-200 text-slate-800 bg-white",
      btnStyle: "bg-slate-100 hover:bg-slate-200 text-slate-800"
    },
    {
      id: "bronze",
      name: "Bronze Starter",
      price: 99,
      downloads: "3 videos per day",
      features: [
        "HD quality stream",
        "Unlock Premium videos",
        "Limited to 3 downloads per day",
        "Standard channel support"
      ],
      color: "border-amber-700 bg-amber-50/20 text-slate-800 shadow-md",
      btnStyle: "bg-amber-750 hover:bg-amber-800 text-white"
    },
    {
      id: "silver",
      name: "Silver Standard",
      price: 199,
      downloads: "5 videos per day",
      features: [
        "Full HD quality stream",
        "Unlock Premium videos",
        "Limited to 5 downloads per day",
        "100% Ad-Free viewing",
        "Priority customer support"
      ],
      color: "border-slate-400 bg-slate-50/20 text-slate-800 shadow-md",
      btnStyle: "bg-slate-700 hover:bg-slate-800 text-white"
    },
    {
      id: "gold",
      name: "Gold Ultimate",
      price: 399,
      downloads: "50 videos per day",
      features: [
        "4K Ultra HD quality stream",
        "Unlock Premium videos",
        "Up to 50 downloads per day",
        "100% Ad-Free viewing",
        "Early access to new releases",
        "VIP dedicated support"
      ],
      color: "border-yellow-500 bg-yellow-50/20 text-slate-800 shadow-lg relative ring-2 ring-yellow-400/50",
      btnStyle: "bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold"
    }
  ];

  const handleCheckout = async (plan: Plan) => {
    if (!user) {
      alert("⚠️ Please sign in first before upgrading your plan.");
      return;
    }

    if (plan.id === "free") {
      alert("You are already on the Free tier by default.");
      return;
    }

    if (user.plan === plan.id) {
      alert(`You are already on the ${plan.name} plan!`);
      return;
    }

    setLoadingOrder(true);
    try {
      // Ensure SDK script is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !(window as any).Razorpay) {
        alert("❌ Failed to load Razorpay Checkout SDK. Please check your internet connection.");
        setLoadingOrder(false);
        return;
      }

      // Step 1: Create a sandbox order on the backend
      const orderRes = await axiosInstance.post(
        "/api/payments/order",
        {
          amount: plan.price,
          planSelected: plan.id,
          userId: user._id
        },
        {
          headers: { "x-user-id": user._id }
        }
      );
      const order = orderRes.data;

      // Step 2: Open Razorpay Checkout (Req #5, #6)
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TQfU4peyTMHyWD", 
        amount: order.amount,
        currency: order.currency || "INR",
        name: "YourTubeIN",
        description: `Upgrade to ${plan.name}`,
        order_id: order.id,
        handler: async function (response: any) {
          try {
            // Step 3: Verify payment on backend with signature (Req #6, #9)
            const verifyRes = await axiosInstance.post(
              "/api/payments/verify",
              {
                userId: user._id,
                email: user.email,
                name: user.name,
                planSelected: plan.id,
                amountPaid: plan.price,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature
              },
              {
                headers: { "x-user-id": user._id }
              }
            );

            if (verifyRes.data.success) {
              setInvoice(verifyRes.data.invoice);
              const updatedUser = verifyRes.data.user || { ...user, plan: plan.id };
              login(updatedUser);
              alert(`🎉 Payment successful! You are now on the ${plan.name.toUpperCase()} plan.`);
            }
          } catch (verifyError: any) {
            console.error("Verification error:", verifyError);
            alert("Payment verification failed: " + (verifyError.response?.data?.error || "Unknown error"));
          }
        },
        prefill: {
          name: user.name || "",
          email: user.email || ""
        },
        theme: {
          color: "#7c3aed" // violet-600
        },
        modal: {
          ondismiss: function () {
            console.log("Payment modal dismissed.");
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        alert("Payment failed: " + (response.error?.description || "Transaction declined"));
      });
      rzp.open();
      
    } catch (error: any) {
      console.error("Checkout error:", error);
      const msg = error?.response?.data?.error || error?.message || "Network error. Make sure backend is running.";
      alert(`❌ Error: ${msg}`);
    } finally {
      setLoadingOrder(false);
    }
  };

  if (invoice) {
    return (
      <main className="flex-1 p-6 flex items-center justify-center min-h-[80vh] bg-slate-50">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xl max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Subscription Activated!</h2>
            <p className="text-sm text-slate-500">Thank you for upgrading your experience.</p>
          </div>

          <div className="border-t border-b border-slate-100 py-4 space-y-3.5 text-sm text-slate-700">
            <h3 className="font-bold text-slate-900 text-center uppercase tracking-wider text-xs">Digital Invoice Receipt</h3>
            <div className="flex justify-between">
              <span className="text-slate-400">Subscriber</span>
              <span className="font-semibold text-slate-800">{invoice.userName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Email</span>
              <span className="text-slate-800 font-mono text-xs">{invoice.userEmail}</span>
            </div>
            <div className="flex justify-between border-t border-dashed border-slate-150 pt-2 mt-2">
              <span className="text-slate-400">Plan Upgraded</span>
              <span className="font-bold text-violet-600 uppercase">{invoice.plan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Amount Paid</span>
              <span className="font-bold text-slate-800">₹{invoice.amount}.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Transaction ID</span>
              <span className="font-mono text-xs text-slate-800">{invoice.transactionId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Order ID</span>
              <span className="font-mono text-xs text-slate-800">{invoice.orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Receipt Date</span>
              <span className="text-slate-800">{new Date(invoice.date).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Link href="/" className="w-full">
              <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold">
                Go to Home Screen
              </Button>
            </Link>
            <Button 
              variant="outline" 
              onClick={() => window.print()}
              className="w-full text-slate-600 border-slate-200"
            >
              Print Receipt
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Upgrade Your Plan</h1>
          <p className="text-slate-600 max-w-lg mx-auto">
            Choose the subscription level that fits your streaming needs. Unlock premium videos, increase daily downloads, and enjoy ad-free viewing!
          </p>
          {user && (
            <div className="inline-flex items-center gap-2 mt-4 px-3 py-1 bg-violet-50 text-violet-700 border border-violet-100 rounded-full text-xs font-semibold">
              Current Active Plan: <span className="uppercase font-bold">{user.plan || "free"}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
          {plans.map((plan) => {
            const isCurrent = user?.plan === plan.id || (!user?.plan && plan.id === "free");
            return (
              <div 
                key={plan.id}
                className={`flex flex-col justify-between p-6 rounded-2xl border-2 bg-white ${plan.color} min-h-[460px] transition-all duration-300 hover:shadow-xl`}
              >
                <div className="space-y-4">
                  {plan.id === "gold" && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-yellow-500 text-slate-950 rounded-full text-[10px] font-bold uppercase tracking-wider shadow">
                      Most Popular
                    </span>
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{plan.name}</h2>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-3xl font-extrabold text-slate-900">₹{plan.price}</span>
                      <span className="text-xs text-slate-500">/ month</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Downloads Limit</p>
                    <p className="text-sm font-semibold text-slate-700">{plan.downloads}</p>
                  </div>

                  <ul className="space-y-2.5 pt-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex gap-2 text-xs text-slate-600 align-top">
                        <Check className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6">
                  <Button
                    onClick={() => handleCheckout(plan)}
                    disabled={isCurrent || loadingOrder}
                    className={`w-full font-semibold rounded-xl ${plan.btnStyle}`}
                  >
                    {isCurrent ? "Active Plan" : `Upgrade to ${plan.name.split(" ")[0]}`}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
