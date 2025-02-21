
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePrivy, useFundWallet } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { base } from "viem/chains";
import { formatEther } from "viem";
import { createPublicClient, http } from "viem";
import { Input } from "@/components/ui/input";

const Dashboard = () => {
  const navigate = useNavigate();
  const { ready, authenticated, user, logout } = usePrivy();
  const { toast } = useToast();
  const { fundWallet } = useFundWallet();
  const [balance, setBalance] = useState<string>("0");
  const [bridgeAmount, setBridgeAmount] = useState("");
  const [isBridging, setIsBridging] = useState(false);

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
          const formattedBalance = parseFloat(formatEther(walletBalance)).toFixed(6);
          setBalance(formattedBalance);
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
    const intervalId = setInterval(fetchBalance, 30000);
    return () => clearInterval(intervalId);
  }, [user?.wallet?.address, publicClient, toast]);

  const handleBridgeFunding = async () => {
    if (!user?.wallet?.address || !bridgeAmount) return;
    
    try {
      setIsBridging(true);
      
      const response = await fetch('https://api.sandbox.bridge.xyz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': process.env.BRIDGE_API_KEY || '',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          amount: bridgeAmount,
          on_behalf_of: "user_" + user.wallet.address.slice(2, 10),
          developer_fee: "0.5",
          source: {
            payment_rail: "ach_push",
            currency: "usd",
          },
          destination: {
            payment_rail: "ethereum",
            currency: "usdc",
            to_address: user.wallet.address,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Bridge funding failed');
      }

      toast({
        title: "Success",
        description: "Bridge funding initiated successfully",
      });
      setBridgeAmount("");
    } catch (error) {
      console.error("Error initiating bridge funding:", error);
      toast({
        title: "Error",
        description: "Failed to initiate bridge funding",
        variant: "destructive",
      });
    } finally {
      setIsBridging(false);
    }
  };

  const handleFundWallet = () => {
    if (!user?.wallet?.address) return;
    fundWallet(user.wallet.address, {
      chain: base,
      amount: "1.00"
    });
  };

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
          <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Fund Wallet</h3>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount in USD"
                  value={bridgeAmount}
                  onChange={(e) => setBridgeAmount(e.target.value)}
                />
                <Button 
                  onClick={handleBridgeFunding}
                  disabled={isBridging || !bridgeAmount}
                >
                  {isBridging ? "Processing..." : "Top-up via ACH"}
                </Button>
              </div>
              <Button 
                className="w-full"
                onClick={handleFundWallet}
                variant="outline"
              >
                Top-up via card
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white rounded-lg shadow-sm p-6"
        >
          <div className="text-center py-8 text-gray-500">
            Your transactions will appear here once you start using your wallet.
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;
