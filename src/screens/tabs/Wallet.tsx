import { CustomAlert } from "@/components/alertbutton/CustomAlert";
import { useWalletConnect } from "@/hooks/useWalletConnect";
import { appChain } from "@/config/chain";
import type { PriceData, PriceHistoryPoint } from "@/services/market.service";
import * as marketService from "@/services/market.service";
import type { WalletBalance, WalletInfo } from "@/services/wallet.service";
import * as walletService from "@/services/wallet.service";
import { useVerificationStore } from "@/stores/verification.store";
import { getWalletErrorMessage } from "@/utils/wallet-errors";
import { Ionicons } from "@expo/vector-icons";
import { useAppKit } from "@/hooks/useAppKit";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDisconnect } from "wagmi";

const screenWidth = Dimensions.get("window").width;
const scrollHPadding = 20;
const analyticsCardPadding = 14;
const chartSideMargin = 12;
const chartPaddingRight = 24;
const chartWidth =
  screenWidth -
  scrollHPadding * 2 -
  analyticsCardPadding * 2 -
  chartSideMargin * 2;

export default function WalletScreen() {
  const [showVerification, setShowVerification] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const isVerified = useVerificationStore((state) => state.isVerified);
  const router = useRouter();

  // WalletConnect hooks
  const {
    address: wcAddress,
    isConnected: wcConnected,
    signVerificationMessage,
  } = useWalletConnect();
  const { open: openAppKit } = useAppKit();
  const { disconnectAsync } = useDisconnect();

  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);

  const [alert, setAlert] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons: {
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }[];
    icon?: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
  }>({ visible: false, title: "", buttons: [] });

  const primaryWallet = wallets.find((w) => w.isPrimary) || wallets[0];
  const primaryBalance = primaryWallet
    ? balances.find((b) => b.id === primaryWallet.id)
    : undefined;

  const fetchWalletData = useCallback(async () => {
    try {
      const [walletsRes, balancesRes] = await Promise.all([
        walletService.getWallets(),
        walletService.getBalances(),
      ]);
      if (walletsRes.success && walletsRes.data) setWallets(walletsRes.data);
      if (balancesRes.success && balancesRes.data)
        setBalances(balancesRes.data);
    } catch (error) {
      console.error("[Wallet] Fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMarketData = useCallback(async () => {
    try {
      const [priceRes, historyRes] = await Promise.all([
        marketService.getPrice(),
        marketService.getPriceHistory(1),
      ]);
      if (priceRes.success && priceRes.data) setPriceData(priceRes.data);
      if (historyRes.success && historyRes.data)
        setPriceHistory(historyRes.data);
    } catch (error) {
      console.error("[Wallet] Market fetch error:", error);
    }
  }, []);

  useEffect(() => {
    fetchWalletData();
    fetchMarketData();
  }, [fetchWalletData, fetchMarketData]);

  // Auto-register wallet with backend when WalletConnect connects
  useEffect(() => {
    if (!wcConnected || !wcAddress) return;

    const alreadyRegistered = wallets.some(
      (w) => w.address.toLowerCase() === wcAddress.toLowerCase(),
    );
    if (alreadyRegistered) return;

    const registerWcWallet = async () => {
      setIsConnecting(true);
      try {
        // Step 1: Request nonce from backend
        const chainId = appChain.id;
        const connectRes = await walletService.connectWallet(wcAddress, chainId);
        if (!connectRes.success || !connectRes.data?.message) {
          throw new Error(
            connectRes.error || "Failed to get verification message",
          );
        }

        // Step 2: Sign the nonce message with WalletConnect
        const signature = await signVerificationMessage(
          connectRes.data.message,
        );

        // Step 3: Verify signature with backend
        const verifyRes = await walletService.verifyWallet(
          wcAddress,
          chainId,
          signature,
          connectRes.data.message,
        );
        if (!verifyRes.success) {
          throw new Error(verifyRes.error || "Wallet verification failed");
        }

        fetchWalletData();
        fetchMarketData();
        setAlert({
          visible: true,
          title: "Wallet Connected",
          message:
            "Your wallet has been connected and verified via WalletConnect.",
          buttons: [{ text: "OK" }],
          icon: "checkmark-circle",
          iconColor: "#10B981",
        });
      } catch (error) {
        console.error("[Wallet] WC registration error:", error);
        setAlert({
          visible: true,
          title: "Connection Failed",
          message: getWalletErrorMessage(error),
          buttons: [{ text: "OK" }],
          icon: "alert-circle",
          iconColor: "#EF4444",
        });
        // Disconnect WalletConnect if backend registration fails
        try {
          await disconnectAsync();
        } catch {}
      } finally {
        setIsConnecting(false);
      }
    };

    registerWcWallet();
  // This effect reacts only to WalletConnect identity transitions. Including
  // the registration callbacks or wallet list would repeat signature prompts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wcConnected, wcAddress]);

  // openAppKit rejects when the session is never approved, and nothing else in
  // this screen would notice: the effect above only runs once a wallet is
  // already connected. Without this a failed connection is completely silent.
  const handleConnectPress = async () => {
    try {
      await openAppKit();
    } catch (error) {
      console.error("[Wallet] AppKit open error:", error);
      setAlert({
        visible: true,
        title: "Connection Failed",
        message: getWalletErrorMessage(error),
        buttons: [{ text: "OK" }],
        icon: "alert-circle",
        iconColor: "#EF4444",
      });
    }
  };

  const handleDisconnect = () => {
    if (!primaryWallet) return;
    setAlert({
      visible: true,
      title: "Disconnect Wallet",
      message: `Remove ${primaryWallet.address.slice(0, 6)}...${primaryWallet.address.slice(-4)}?`,
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            // Disconnect WalletConnect session if active
            if (wcConnected) {
              try {
                await disconnectAsync();
              } catch {}
            }
            const result = await walletService.removeWallet(primaryWallet.id);
            if (result.success) {
              fetchWalletData();
            } else {
              setAlert({
                visible: true,
                title: "Error",
                message: result.error || "Failed to disconnect",
                buttons: [{ text: "OK" }],
                icon: "alert-circle",
                iconColor: "#EF4444",
              });
            }
          },
        },
      ],
      icon: "warning",
      iconColor: "#F59E0B",
    });
  };

  // Build chart data from price history
  const chartData = (() => {
    if (priceHistory.length < 2) {
      return {
        labels: ["--"],
        datasets: [
          {
            data: [0],
            color: (opacity = 1) => `rgba(46, 169, 150, ${opacity})`,
            strokeWidth: 2.5,
          },
        ],
      };
    }
    const sampled = priceHistory
      .filter(
        (_, i) => i % Math.max(1, Math.floor(priceHistory.length / 6)) === 0,
      )
      .slice(0, 6);
    return {
      labels: sampled.map((p) => {
        const d = new Date(p.createdAt);
        return `${d.getHours()}h`;
      }),
      datasets: [
        {
          data: sampled.map((p) => p.ethPricePHP),
          color: (opacity = 1) => `rgba(46, 169, 150, ${opacity})`,
          strokeWidth: 2.5,
        },
      ],
    };
  })();

  const chartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(46, 169, 150, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(75, 85, 99, ${opacity})`,
    propsForDots: {
      r: "5",
      strokeWidth: "2.5",
      stroke: "#ffffff",
      fill: "#2eaa96",
    },
    propsForBackgroundLines: {
      strokeDasharray: "",
      stroke: "#d8dde6",
      strokeWidth: 1,
    },
    fillShadowGradient: "#39b6a4",
    fillShadowGradientOpacity: 0.24,
  };

  const renderVerifyBanner = !isVerified ? (
    <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-5 flex-row items-center justify-between">
      <View className="flex-1 mr-3">
        <Text className="text-base font-semibold text-gray-900">
          Verify your account
        </Text>
        <Text className="text-sm text-gray-600 mt-1">
          Verify your account to view wallet details.
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => setShowVerification(true)}
        className="bg-black px-4 py-2 rounded-full"
      >
        <Text className="text-white font-semibold text-sm">Verify</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  if (showVerification) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#f4f5f7" }}
        edges={["right", "bottom", "left"]}
      >
        <View className="flex-1 bg-white">
          <TouchableOpacity
            onPress={() => setShowVerification(false)}
            className="absolute top-3 right-6 z-10 w-10 h-10 items-center justify-center"
          >
            <Ionicons name="close" size={28} color="#000" />
          </TouchableOpacity>

          <View className="flex-1 items-center justify-center px-8">
            <View className="relative mb-12">
              <View className="w-32 h-32 items-center justify-center">
                <View className="absolute top-0 right-0">
                  <View className="bg-orange-400 w-20 h-24 rounded-lg items-center justify-center">
                    <View className="w-12 h-16">
                      <View className="absolute top-2 left-2 w-2 h-12 bg-white rounded-full rotate-45" />
                      <View className="absolute top-4 left-6 w-2 h-10 bg-white rounded-full rotate-45" />
                      <View className="absolute top-6 left-10 w-2 h-8 bg-white rounded-full rotate-45" />
                    </View>
                  </View>
                </View>
                <View className="absolute bottom-0 left-4 w-16 h-16 bg-blue-100 rounded-full items-center justify-center">
                  <View className="w-12 h-12 bg-blue-500 rounded-full items-center justify-center">
                    <Ionicons name="shield-checkmark" size={24} color="#fff" />
                  </View>
                </View>
              </View>
            </View>

            <Text className="text-2xl font-bold mb-4 text-center">
              Let's get you verified
            </Text>

            <Text className="text-gray-600 text-center leading-6 mb-12">
              To ensure secure access and the proper use of Avelon's features
              and services, we kindly request that you verify your identity.
              This verification is necessary to confirm your authenticity.
            </Text>

            <TouchableOpacity
              onPress={() => router.push("/(verification)/BasicInformation")}
              className="bg-black w-full py-4 rounded-full"
            >
              <Text className="text-white font-semibold text-base text-center">
                Get Started
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#f4f5f7" }}
      edges={["right", "bottom", "left"]}
    >
      <View className="flex-1 bg-[#f4f5f7]">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 140,
            marginTop: 25,
          }}
        >
          {renderVerifyBanner}

          {/* Connecting overlay */}
          {isConnecting && (
            <View className="bg-white rounded-2xl p-5 mb-4 border border-gray-200 items-center">
              <ActivityIndicator size="large" color="#f8893c" />
              <Text className="text-sm text-gray-600 mt-3">
                Verifying wallet connection...
              </Text>
            </View>
          )}

          {isLoading ? (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" color="#f8893c" />
            </View>
          ) : wallets.length === 0 ? (
            /* No Wallet State */
            <View
              style={{
                backgroundColor: "#f8893c",
                borderRadius: 28,
                padding: 24,
                marginBottom: 16,
                alignItems: "center",
              }}
            >
              <Ionicons
                name="wallet-outline"
                size={48}
                color="#fff"
                style={{ marginBottom: 12 }}
              />
              <Text className="text-white text-lg font-bold mb-2">
                No Wallet Connected
              </Text>
              <Text className="text-[#ffd7c1] text-sm text-center mb-5">
                Connect your Ethereum wallet to view balances and apply for
                loans.
              </Text>

              {/* Primary: WalletConnect */}
              <TouchableOpacity
                onPress={handleConnectPress}
                disabled={isConnecting}
                style={{
                  backgroundColor: "rgba(255,255,255,0.22)",
                  borderRadius: 18,
                  paddingVertical: 12,
                  paddingHorizontal: 32,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.3)",
                  marginBottom: 12,
                }}
              >
                <Text className="text-white font-semibold text-base">
                  Connect Wallet
                </Text>
              </TouchableOpacity>

              <Text className="text-[#ffeede] text-xs text-center">
                A signature is required to prove wallet ownership. No gas fee is charged.
              </Text>
            </View>
          ) : (
            <>
              {/* Balance Card */}
              <View
                style={{
                  backgroundColor: "#f8893c",
                  borderRadius: 28,
                  padding: 18,
                  marginBottom: 16,
                  overflow: "hidden",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.18,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    bottom: -70,
                    left: -40,
                    width: 220,
                    height: 220,
                    borderRadius: 110,
                    backgroundColor: "rgba(255,255,255,0.07)",
                  }}
                />

                <View
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    backgroundColor: primaryWallet?.isVerified
                      ? "rgba(16,185,129,0.2)"
                      : "rgba(255,255,255,0.18)",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: primaryWallet?.isVerified
                      ? "rgba(16,185,129,0.4)"
                      : "rgba(255,255,255,0.25)",
                  }}
                >
                  <Text
                    className={`text-[11px] font-semibold ${primaryWallet?.isVerified ? "text-green-100" : "text-[#ffeede]"}`}
                  >
                    {primaryWallet?.isVerified ? "Verified" : "Pending"}
                  </Text>
                </View>

                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="text-[#ffe7d4] text-xs font-semibold uppercase mb-1">
                      Balance
                    </Text>
                    <Text className="text-white text-[28px] font-extrabold leading-tight mb-1">
                      {primaryBalance?.balance
                        ? `${parseFloat(primaryBalance.balance).toFixed(6)} ETH`
                        : "-- ETH"}
                    </Text>
                    {priceData && primaryBalance?.balance && (
                      <Text className="text-[#ffd7c1] text-sm font-semibold">
                        ₱{" "}
                        {(
                          parseFloat(primaryBalance.balance) *
                          priceData.ethPricePHP
                        ).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                    )}
                    <Text className="text-[#ffe7d4] text-[10px] mt-2">
                      {primaryWallet
                        ? `${primaryWallet.address.slice(0, 6)}...${primaryWallet.address.slice(-4)}`
                        : ""}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    marginTop: 18,
                    gap: 12,
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      setIsLoading(true);
                      fetchWalletData();
                      fetchMarketData();
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: "rgba(255,255,255,0.18)",
                      borderRadius: 18,
                      paddingVertical: 12,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.24)",
                    }}
                  >
                    <Ionicons name="refresh" size={22} color="#fff" />
                    <Text className="text-white font-semibold text-[13px] mt-2">
                      Refresh
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleDisconnect}
                    style={{
                      flex: 1,
                      backgroundColor: "rgba(255,255,255,0.18)",
                      borderRadius: 18,
                      paddingVertical: 12,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.24)",
                    }}
                  >
                    <Ionicons name="power" size={22} color="#fff" />
                    <Text className="text-white font-semibold text-[13px] mt-2">
                      Disconnect
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Overview */}
              <View
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 16,
                  shadowColor: "#000",
                  shadowOpacity: 0.05,
                  shadowOffset: { width: 0, height: 4 },
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <Text className="text-[11px] font-semibold text-[#9ca3af] uppercase mb-3">
                  Wallet Details
                </Text>

                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-[13px] text-[#6b7280]">Address</Text>
                  <Text className="text-[13px] font-medium text-[#111827]">
                    {primaryWallet
                      ? `${primaryWallet.address.slice(0, 10)}...${primaryWallet.address.slice(-6)}`
                      : "--"}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-[13px] text-[#6b7280]">Status</Text>
                  <Text
                    className={`text-[13px] font-medium ${primaryWallet?.isVerified ? "text-green-600" : "text-yellow-600"}`}
                  >
                    {primaryWallet?.isVerified
                      ? "Verified"
                      : "Pending Verification"}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-[13px] text-[#6b7280]">
                    Connected Wallets
                  </Text>
                  <Text className="text-[13px] font-medium text-[#111827]">
                    {wallets.length}
                  </Text>
                </View>
                {wcConnected && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[13px] text-[#6b7280]">
                      WalletConnect
                    </Text>
                    <Text className="text-[13px] font-medium text-green-600">
                      Active
                    </Text>
                  </View>
                )}
              </View>

              {/* Analytics */}
              <Text className="text-[11px] font-semibold text-[#9ca3af] uppercase mb-3">
                Analytics
              </Text>
              <View
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: 18,
                  padding: 14,
                  shadowColor: "#000",
                  shadowOpacity: 0.05,
                  shadowOffset: { width: 0, height: 4 },
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-[15px] font-semibold text-[#111827]">
                    ETH Price Volatility
                  </Text>
                  <View
                    style={{
                      backgroundColor: "rgba(248,140,60,0.12)",
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "rgba(248,140,60,0.24)",
                    }}
                  >
                    <Text className="text-[11px] font-semibold text-[#f58a2e] uppercase">
                      Predictor
                    </Text>
                  </View>
                </View>

                <View className="items-center">
                  <LineChart
                    data={chartData}
                    width={chartWidth}
                    height={190}
                    chartConfig={chartConfig}
                    bezier
                    style={{
                      marginVertical: 4,
                      borderRadius: 12,
                      alignSelf: "center",
                      paddingRight: chartPaddingRight,
                    }}
                    withInnerLines={true}
                    withOuterLines={false}
                    withVerticalLines={true}
                    withHorizontalLines={true}
                    withDots={true}
                    withShadow={true}
                    segments={4}
                  />
                </View>

                <View className="flex-row items-center justify-center mt-2">
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: "#2eaa96",
                      marginRight: 8,
                    }}
                  />
                  <Text className="text-[#6b7280] text-[11px] font-medium">
                    {priceData
                      ? `Current: ₱${priceData.ethPricePHP.toLocaleString()}`
                      : "Loading..."}
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        <CustomAlert
          visible={alert.visible}
          title={alert.title}
          message={alert.message}
          buttons={alert.buttons}
          icon={alert.icon}
          iconColor={alert.iconColor}
          onClose={() => setAlert((prev) => ({ ...prev, visible: false }))}
        />
      </View>
    </SafeAreaView>
  );
}
