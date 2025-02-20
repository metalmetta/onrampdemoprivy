
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePrivy, useFundWallet } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { base } from "viem/chains";
import { formatEther } from "viem";
import { createPublicClient, http } from "viem";

const Dashboard = () => {
  const navigate = useNavigate();
  const { ready, authenticated, user, logout } = usePrivy();
  const { toast } = useToast();
  const { fundWallet } = useFundWallet();
  const [balance, setBalance] = useState<string>("0");

  const publicClient = createPublicClient({
    chain: base,
    transport: http()
  });

  useEffect(() => {
    if (ready && !authenticated) {
      navigate("/");
    }
  }, [ready, authenticated, navigate]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (user?.wallet?.address) {
        try {
          const walletBalance = await publicClient.getBalance({
            address: user.wallet.address as `0x${string}`
          });
          setBalance(formatEther(walletBalance));
        } catch (error) {
          console.error("Error fetching balance:", error);
          toast({
            title: "Error",
            description: "Failed to fetch wallet balance",
            variant: "destructive",
          });
        }
      }
    };

    fetchBalance();
    // Set up an interval to refresh the balance every 30 seconds
    const intervalId = setInterval(fetchBalance, 30000);

    return () => clearInterval(intervalId);
  }, [user?.wallet?.address, publicClient, toast]);

  useEffect(() => {
    if (user?.wallet?.address) {
      toast({
        title: "Fund Your Wallet",
        description: "Add funds to get started with crypto payments",
        action: (
          <Button
            onClick={() => {
              fundWallet(user.wallet.address, {
                chain: base,
                amount: "1.00"
              });
            }}
            variant="default"
            size="sm"
          >
            Fund Wallet
          </Button>
        ),
        duration: 10000,
      });
    }
  }, [user?.wallet?.address, fundWallet]);

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <Button variant="outline" onClick={() => logout()}>
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Wallet Address</h3>
            <p className="text-sm font-mono break-all">{user?.wallet?.address}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Balance</h3>
            <p className="text-2xl font-semibold text-gray-900">{balance} ETH</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Network</h3>
            <p className="text-lg font-semibold text-gray-900">Base</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white rounded-lg shadow-sm p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Transactions
            </h2>
            <Button>Send ETH</Button>
          </div>

          <div className="text-center py-8 text-gray-500">
            No transactions yet. Send your first transaction to get started.
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;
