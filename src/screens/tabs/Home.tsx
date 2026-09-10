import type { LoanPlan } from "@/services/loan.service";
import * as loanService from "@/services/loan.service";
import type { PriceData, PriceHistoryPoint } from "@/services/market.service";
import * as marketService from "@/services/market.service";
import type { WalletBalance } from "@/services/wallet.service";
import * as walletService from "@/services/wallet.service";
import { useVerificationStore } from "@/stores/verification.store";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    AppState,
    ActivityIndicator,
    Dimensions,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import { CustomAlert } from "../../components/alertbutton/CustomAlert";

export default function HomeScreen() {
  const screenWidth = Dimensions.get("window").width;
  const { bottom } = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 84; // buffer to clear bottom tab bar
  const [showVerification, setShowVerification] = useState(false);
  const isVerified = useVerificationStore((state) => state.isVerified);
  const kycStatus = useVerificationStore((state) => state.kycStatus);
  const kycRejectionReason = useVerificationStore((state) => state.kycRejectionReason);
  const checkKycStatus = useVerificationStore((state) => state.checkKycStatus);
  const resetFormData = useVerificationStore((state) => state.resetFormData);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  }>({
    visible: false,
    title: "",
    buttons: [],
  });
  const router = useRouter();

  const [loanPlans, setLoanPlans] = useState<LoanPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [selectedDays, setSelectedDays] = useState(7);
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(
    null,
  );

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const result = await loanService.getLoanPlans();
      if (result.success && result.data) {
        setLoanPlans(result.data.slice(0, 2));
      }
    } catch (error) {
      console.error("[Home] Fetch plans error:", error);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const fetchMarketData = useCallback(async (days: number) => {
    try {
      const [priceResult, historyResult] = await Promise.all([
        marketService.getPrice(),
        marketService.getPriceHistory(days),
      ]);
      if (priceResult.success && priceResult.data) {
        setPriceData(priceResult.data);
      }
      if (historyResult.success && historyResult.data) {
        setPriceHistory(historyResult.data);
      }
    } catch (error) {
      console.error("[Home] Fetch market error:", error);
    }
  }, []);

  useEffect(() => {
    fetchMarketData(selectedDays);
  }, [selectedDays, fetchMarketData]);

  useEffect(() => {
    if (isVerified) {
      fetchPlans();
      walletService
        .getBalances()
        .then((res) => {
          if (res.success && res.data && res.data.length > 0) {
            const primary = res.data.find((w) => w.isPrimary) || res.data[0];
            setWalletBalance(primary);
          }
        })
        .catch(() => {});
    }
  }, [isVerified, fetchPlans]);

  // Refresh pending KYC at a modest interval and only while active.
  useEffect(() => {
    if (kycStatus === "PENDING_KYC") {
      checkKycStatus();
      pollRef.current = setInterval(() => {
        if (AppState.currentState === "active") checkKycStatus();
      }, 30000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [kycStatus, checkKycStatus]);

  const TIME_OPTIONS = [
    { label: "1D", days: 1 },
    { label: "1W", days: 7 },
    { label: "1M", days: 30 },
    { label: "3M", days: 90 },
    { label: "1Y", days: 365 },
  ];

  // Build chart data from API history
  // Sample labels from history timestamps (show ~5 labels max)
  const labelStep = Math.max(1, Math.floor(priceHistory.length / 5));
  const chartLabels =
    priceHistory.length > 0
      ? priceHistory
          .filter((_, i) => i % labelStep === 0)
          .map((p) => {
            const d = new Date(p.createdAt);
            return selectedDays <= 1
              ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : `${d.getMonth() + 1}/${d.getDate()}`;
          })
      : ["--"];

  // Pad if labels/data mismatch for chart library
  const sampledData =
    priceHistory.length > 0
      ? priceHistory
          .filter((_, i) => i % labelStep === 0)
          .map((p) => p.ethPricePHP)
      : [0];

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        data: sampledData.length > 0 ? sampledData : [0],
        color: (opacity = 1) => `rgba(255, 140, 66, 1)`,
        strokeWidth: 3,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: "#fff",
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 140, 66, 0.95)`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "0",
    },
    propsForBackgroundLines: {
      strokeDasharray: "",
      stroke: "#E5E7EB",
      strokeWidth: 1,
    },
  };

  const handleApplyLoan = () => {
    if (!isVerified) {
      setAlert({
        visible: true,
        title: "Account verification required",
        message: "Please verify your account first to apply for a loan.",
        icon: "shield-checkmark",
        iconColor: "#0f172a",
        buttons: [
          {
            text: "Verify now",
            onPress: () => setShowVerification(true),
          },
          {
            text: "Maybe later",
            style: "cancel",
          },
        ],
      });
      return;
    }

    router.push("/LoanPlans");
  };

  const renderVerifyBanner = (() => {
    if (isVerified) return null;

    if (kycStatus === "PENDING_KYC") {
      return (
        <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex-row items-center">
          <ActivityIndicator
            size="small"
            color="#D97706"
            style={{ marginRight: 12 }}
          />
          <View className="flex-1">
            <Text className="text-base font-semibold text-amber-900">
              Verification in progress
            </Text>
            <Text className="text-sm text-amber-700 mt-1">
              We're reviewing your documents. This usually takes a few minutes.
            </Text>
          </View>
        </View>
      );
    }

    if (kycStatus === "REJECTED") {
      return (
        <View className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5 flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-base font-semibold text-red-900">
              Verification rejected
            </Text>
            <Text className="text-sm text-red-700 mt-1">
              {kycRejectionReason ??
                "Please re-submit your documents with the correct information."}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowVerification(true)}
            className="bg-red-600 px-4 py-2 rounded-full"
          >
            <Text className="text-white font-semibold text-sm">Re-verify</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-5 flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-base font-semibold text-gray-900">
            Verify your account
          </Text>
          <Text className="text-sm text-gray-600 mt-1">
            Verify your account now to see details.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowVerification(true)}
          className="bg-black px-4 py-2 rounded-full"
        >
          <Text className="text-white font-semibold text-sm">Verify</Text>
        </TouchableOpacity>
      </View>
    );
  })();

  const closeAlert = () =>
    setAlert((prev) => ({
      ...prev,
      visible: false,
    }));

  if (showVerification) {
    return (
      <SafeAreaView
        className="flex-1 bg-white"
        edges={["right", "bottom", "left"]}
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 0,
            paddingBottom: bottom + 24,
          }}
          contentInsetAdjustmentBehavior="never"
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
                      <Ionicons
                        name="shield-checkmark"
                        size={24}
                        color="#fff"
                      />
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
                onPress={() => {
                  resetFormData();
                  router.push("/(verification)/BasicInformation");
                }}
                className="bg-black w-full py-4 rounded-full"
              >
                <Text className="text-white font-semibold text-base text-center">
                  Get Started
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      edges={["right", "bottom", "left"]}
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: bottom + TAB_BAR_HEIGHT,
          marginTop: 20,
        }}
        contentInsetAdjustmentBehavior="never"
      >
        {/* Hero Section */}
        <View className="px-5">
          {renderVerifyBanner}

          <Text className="text-xl font-semibold text-gray-900 mb-4">
            Borrow crypto, instantly!
          </Text>

          {/* Balance Cards */}
          <View className="flex-row justify-between gap-3 mb-6">
            {/* Current Balance Card */}
            <View className="flex-1 bg-gray-50 rounded-2xl p-4">
              <View className="flex-row items-center mb-2">
                <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                <Text className="text-xs text-gray-600">Current</Text>
              </View>
              <Text className="text-sm text-gray-500 mb-1">Balance</Text>
              <Text className="text-base font-bold text-gray-900">
                {walletBalance?.balance
                  ? `${parseFloat(walletBalance.balance).toFixed(6)} ETH`
                  : "-- ETH"}
              </Text>
            </View>

            {/* Loan Application Card */}
            <TouchableOpacity
              className="flex-1 bg-[#FF8C42] rounded-2xl p-4"
              onPress={handleApplyLoan}
              activeOpacity={0.9}
            >
              <View className="flex-row items-center mb-2">
                <View className="w-2 h-2 rounded-full bg-white mr-2" />
                <Text className="text-xs text-white">Loan</Text>
              </View>
              <Text className="text-sm text-white mb-1">Application</Text>
              <Text className="text-base font-bold text-white">
                Apply for a Loan
              </Text>
            </TouchableOpacity>
          </View>

          {/* Chart Section */}
          <View className="bg-white rounded-2xl mb-6">
            <Text className="text-base font-semibold text-gray-900 mb-1">
              ETH/PHP Price
            </Text>
            {priceData && (
              <View className="flex-row items-center mb-3">
                <Text className="text-lg font-bold text-gray-900 mr-2">
                  ₱{priceData.ethPricePHP.toLocaleString()}
                </Text>
                <Text
                  className={`text-xs font-medium ${
                    priceData.changePercent24h >= 0
                      ? "text-green-600"
                      : "text-red-500"
                  }`}
                >
                  {priceData.changePercent24h >= 0 ? "+" : ""}
                  {priceData.changePercent24h.toFixed(2)}%
                </Text>
              </View>
            )}

            <LineChart
              data={chartData}
              width={screenWidth - 72}
              height={180}
              chartConfig={chartConfig}
              bezier
              style={{
                marginVertical: 4,
                borderRadius: 12,
              }}
              withInnerLines={true}
              withOuterLines={false}
              withVerticalLines={false}
              withHorizontalLines={true}
              withDots={true}
              withShadow={true}
              segments={4}
            />

            {/* Time Period Selector */}
            <View className="flex-row justify-around mt-3">
              {TIME_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.days}
                  onPress={() => setSelectedDays(opt.days)}
                  className={`px-3 py-1.5 rounded-full ${
                    selectedDays === opt.days ? "bg-gray-900" : "bg-gray-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      selectedDays === opt.days ? "text-white" : "text-gray-500"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Available Loans Section */}
          {isVerified && (
            <View className="mb-6">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-semibold text-gray-900">
                  Available Loans
                </Text>
                <TouchableOpacity>
                  <Text className="text-sm text-[#FF8C42] font-medium">
                    See all
                  </Text>
                </TouchableOpacity>
              </View>

              {plansLoading ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color="#1F2937" />
                </View>
              ) : loanPlans.length > 0 ? (
                loanPlans.map((plan, index) => (
                  <TouchableOpacity
                    key={plan.id}
                    className="bg-gray-50 rounded-2xl p-4 mb-3 flex-row items-center"
                    activeOpacity={0.9}
                    onPress={() =>
                      router.push({
                        pathname: "/loan-application",
                        params: {
                          planId: plan.id,
                          title: plan.name,
                          amount: String(plan.maxAmount),
                          interest: `${plan.interestRate}%`,
                          duration: String(plan.durationOptions[0] || 30),
                        },
                      })
                    }
                  >
                    <View
                      className={`w-1 h-16 ${index === 0 ? "bg-green-500" : "bg-red-500"} rounded-full mr-4`}
                    />
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-gray-900 mb-1">
                        {plan.name}
                      </Text>
                      <Text className="text-xs text-gray-500 mb-2">
                        APR: {plan.interestRate}% / {plan.durationOptions[0]}{" "}
                        days
                      </Text>
                      <Text className="text-lg font-bold text-gray-900">
                        {plan.maxAmount} ETH
                      </Text>
                    </View>
                    <View className="w-10 h-10 rounded-full bg-gray-900 justify-center items-center">
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View className="bg-gray-50 rounded-2xl p-4 items-center">
                  <Text className="text-sm text-gray-500">
                    No plans available
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <CustomAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onClose={closeAlert}
        icon={alert.icon}
        iconColor={alert.iconColor}
      />
    </SafeAreaView>
  );
}
