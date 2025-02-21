import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePrivy, useFundWallet } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { base } from "viem/chains";
import { formatEther, parseEther } from "viem";
import { createPublicClient, http } from "viem";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Dashboard = () => {
  const navigate = useNavigate();
  const { ready, authenticated, user, logout } = usePrivy();
  const { toast } = useToast();
  const { fundWallet } = useFundWallet();
  const [balance, setBalance] = useState<string>("0");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [bridgeAmount, setBridgeAmount] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isBridging, setIsBridging] = useState(false);
  const [recentBills, setRecentBills] = useState([
    { 
      id: 1, 
      description: "Acme Limited", 
      amount: "12000.00", 
      receivedDate: "2023-10-01", 
      dueDate: "2023-10-15", 
      bankAccount: "Account #1234" 
    },
    { 
      id: 2, 
      description: "SpaceX Inc", 
      amount: "8500.00", 
      receivedDate: "2023-10-05", 
      dueDate: "2023-10-20", 
      bankAccount: "Account #5678" 
    },
    { 
      id: 3, 
      description: "Campbell Soup LLC", 
      amount: "800.00", 
      receivedDate: "2023-10-10", 
      dueDate: "2023-10-25", 
      bankAccount: "Account #9101" 
    },
  ]);

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
          // Format the balance to 6 decimal places
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
    // Set up an interval to refresh the balance every 30 seconds
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
          'Api-Key': process.env.BRIDGE_API_KEY || '', // We'll set this up later
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

  const handleSendEth = async () => {
    if (!user?.wallet) return;
    
    try {
      setIsSending(true);
      const amountInWei = parseEther(amount);
      
      const tx = await user.wallet.sendTransaction({
        to: recipientAddress,
        value: amountInWei,
        chainId: base.id
      });

      await tx.wait(); // Wait for transaction confirmation

      toast({
        title: "Success",
        description: "Transaction sent successfully",
      });

      // Reset form
      setRecipientAddress("");
      setAmount("");
    } catch (error) {
      console.error("Error sending transaction:", error);
      toast({
        title: "Error",
        description: "Failed to send transaction",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

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
          <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Fund Wallet</h3>
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
              Recent Bills
            </h2>
          </div>
          <div className="space-y-4">
            {recentBills.map((bill) => (
              <div key={bill.id} className="flex justify-between items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500">{bill.description}</p>
                  <p className="text-lg font-semibold text-gray-900">${bill.amount}</p>
                  <p className="text-sm text-gray-500">Received: {bill.receivedDate}</p>
                  <p className="text-sm text-gray-500">Due: {bill.dueDate}</p>
                  <p className="text-sm text-gray-500">Bank Account: {bill.bankAccount}</p>
                </div>
                <Button onClick={() => handlePayBill(bill.id)}>Pay</Button>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

// Function to handle bill payment (you can implement the logic as needed)
const handlePayBill = (billId: number) => {
  console.log(`Paying bill with ID: ${billId}`);
  // Implement payment logic here
};

export default Dashboard;
