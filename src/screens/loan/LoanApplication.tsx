import { CustomAlert } from "@/components/alertbutton/CustomAlert";
import { useToast } from "@/components/toast";
import * as loanService from "@/services/loan.service";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function TermsAndConditionsModal({
  visible,
  loanTitle,
  onAgree,
  onClose,
}: {
  visible: boolean;
  loanTitle: string;
  onAgree: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
          <TouchableOpacity
            onPress={onClose}
            className="w-10 h-10 rounded-full bg-gray-100 justify-center items-center"
          >
            <Ionicons name="arrow-back" size={20} color="#000" />
          </TouchableOpacity>
          <View className="flex-1 ml-3">
            <Text className="text-sm text-gray-500">Loan Application</Text>
            <Text className="text-lg font-bold text-black">{loanTitle}</Text>
          </View>
        </View>

        {/* Terms Content */}
        <ScrollView
          className="flex-1 px-5 pt-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <Text className="text-xl font-bold text-black mb-4">
            Terms and Conditions
          </Text>

          <Text className="text-sm text-gray-700 leading-5 mb-4">
            Welcome to Avelon. By using our services, you agree to comply with
            these Terms and Conditions.
          </Text>

          <Text className="text-sm text-gray-700 leading-5 mb-3">
            1. To use our services, you must be at least 18 years old and has a
            valid bank account.
          </Text>

          <Text className="text-sm text-gray-700 leading-5 mb-3">
            2. To apply for a loan, you must provide accurate and complete
            information and consent to our verification of the provided
            information.
          </Text>

          <Text className="text-sm text-gray-700 leading-5 mb-3">
            3. We will review your application and notify you of our decision
            within 2 business days. If approved, we will provide the loan amount
            to your bank account.
          </Text>

          <Text className="text-sm text-gray-700 leading-5 mb-3">
            4. You agree to repay the loan amount along with any applicable
            interest and fees according to the repayment schedule provided. Late
            payments may result in additional charges.
          </Text>

          <Text className="text-sm text-gray-700 leading-5 mb-3">
            5. We may charge fees for processing your loan application, late
            payments, and other services as disclosed before you agree to the
            loan terms.
          </Text>

          <Text className="text-sm text-gray-700 leading-5 mb-3">
            6. We respect your privacy and will protect your personal
            information. We will not share your information with third parties
            without your consent, except as required by law.
          </Text>

          <Text className="text-sm text-gray-700 leading-5 mb-3">
            7. We reserve the right to terminate your access to our services if
            you violate these Terms and Conditions or engage in fraudulent
            activities.
          </Text>

          <Text className="text-sm text-gray-700 leading-5 mb-3">
            8. Everyone can use our services, regardless of race, gender,
            disability, or other personal traits, in line with Philippine laws.
          </Text>
        </ScrollView>

        {/* I Agree Button */}
        <View className="px-5 pb-6 pt-3 bg-white border-t border-gray-100">
          <TouchableOpacity
            onPress={onAgree}
            className="bg-gray-900 rounded-2xl py-4 items-center"
          >
            <Text className="text-white text-base font-semibold">I Agree</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function LoanApplication() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{
    planId: string;
    title: string;
    amount: string;
    interest?: string;
    duration?: string;
  }>();

  const planId = params.planId || "";
  const loanTitle = params.title || "Starting Loan Plan";
  const loanAmount = Number(params.amount) || 0;
  const interestRate = params.interest || "5%";
  const duration = params.duration || "30";

  const [purpose, setPurpose] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleAgreeTerms = () => {
    setAgreedToTerms(true);
    setShowTerms(false);
  };

  const principalAmount = loanAmount;
  const interestRateValue = Number(
    (interestRate || "0").replace(/%/g, "").trim(),
  );
  const durationDays = Number(duration) || 30;
  const monthsCount = Math.max(1, Math.round(durationDays / 30));
  const totalInterest = principalAmount * (interestRateValue / 100) * (durationDays / 365);
  const monthlyRepayment = monthsCount
    ? (principalAmount + totalInterest) / monthsCount
    : 0;
  const formattedMonthlyRepayment = `${monthlyRepayment.toFixed(6)} ETH`;
  const handleApply = async () => {
    if (!planId) {
      setAlert({
        visible: true,
        title: "Error",
        message: "Invalid loan plan. Please go back and select a plan.",
        icon: "alert-circle-outline",
        iconColor: "#EF4444",
        buttons: [{ text: "OK" }],
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get user's wallet
      const walletResult = await loanService.getWallets();
      if (!walletResult.success || !walletResult.data?.length) {
        setAlert({
          visible: true,
          title: "No Wallet Connected",
          message: "Please connect a wallet before applying for a loan.",
          icon: "wallet-outline",
          iconColor: "#F59E0B",
          buttons: [{ text: "OK" }],
        });
        return;
      }

      const wallet = walletResult.data.find((item) => item.isPrimary) ?? walletResult.data[0];
      const walletId = wallet.id;

      // Parse duration to number of days (e.g., "30" -> 30, passed from LoanPlans screen)
      const durationDays = parseInt(duration, 10) || 30;

      const result = await loanService.applyForLoan({
        planId,
        amount: String(loanAmount),
        duration: durationDays,
        walletId,
        purpose: purpose.trim(),
      });

      if (!result.success) {
        setAlert({
          visible: true,
          title: "Application Failed",
          message: result.error || "Failed to submit loan application.",
          icon: "alert-circle-outline",
          iconColor: "#EF4444",
          buttons: [{ text: "OK" }],
        });
        return;
      }

      // No collateral prompt here: the loan has no on-chain identity until an admin
      // approves it, so there is nothing to deposit against yet. Records shows the
      // application as Awaiting Review and offers the deposit once it is approved.
      toast.success("Loan applied — awaiting review");
      router.replace("/(tabs)/Records");
    } catch (error) {
      console.error("[LoanApplication] Apply error:", error);
      setAlert({
        visible: true,
        title: "Error",
        message: "Something went wrong. Please try again.",
        icon: "alert-circle-outline",
        iconColor: "#EF4444",
        buttons: [{ text: "OK" }],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-100 justify-center items-center absolute left-5 z-10"
        >
          <Ionicons name="arrow-back" size={20} color="#000" />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-xs text-gray-500">Loan Application</Text>
          <Text className="text-base font-bold text-black">{loanTitle}</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Loan Plan Card */}
        <View className="mx-5 mt-5 bg-gray-50 rounded-2xl p-5 flex-row">
          {/* Left gray accent bar */}
          <View className="w-1 rounded-full bg-gray-300 mr-4" />

          {/* Card content */}
          <View className="flex-1">
            <View className="flex-row items-start justify-between mb-3">
              <Text className="text-base font-bold text-gray-900 flex-1 mr-2">
                {loanTitle}
              </Text>
              <View className="w-9 h-9 rounded-xl  justify-center items-center">
                <Image
                  source={require("../../../assets/images/avelon_icon_nobg_big 1.png")}
                  className="w-10 h-10"
                  resizeMode="contain"
                />
              </View>
            </View>

            <Text className="text-xs text-gray-400 mb-1">
              {interestRate} Interest Rate for {duration}
            </Text>

            <Text className="text-xl font-bold text-gray-900">
              {loanAmount.toFixed(6)} ETH
            </Text>
          </View>
        </View>

        {/* Stated Purpose */}
        <View className="mx-5 mt-6">
          <Text className="text-sm font-semibold text-gray-900 mb-3">
            Stated Purpose
          </Text>
          <View className="rounded-2xl border border-gray-200 px-4 py-3 min-h-[100px]">
            <TextInput
              placeholder="State the purpose for the loan"
              placeholderTextColor="#C0C0C0"
              value={purpose}
              onChangeText={setPurpose}
              multiline
              textAlignVertical="top"
              className="text-sm text-gray-900 min-h-[80px]"
            />
          </View>
        </View>

        {/* Terms and Conditions Agreement */}
        <View className="mx-5 mt-6">
          <Text className="text-xs text-gray-500 leading-4 mb-4">
            By checking this checkbox, I agree with the given Terms and
            Conditions. I acknowledge that I have read and understood the terms
            and conditions set forth by the company, and I agree to comply with
            all policies and guidelines. I understand that failure to comply
            with these terms may result in termination of services or other
            legal actions.
          </Text>

          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => {
                const next = !agreedToTerms;
                setAgreedToTerms(next);
                if (next) {
                  setShowTerms(true);
                }
              }}
              className="mr-3"
            >
              <View
                className={`w-5 h-5 rounded border-2 justify-center items-center ${
                  agreedToTerms
                    ? "bg-gray-900 border-gray-900"
                    : "border-gray-300 bg-white"
                }`}
              >
                {agreedToTerms && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
            <Text className="text-sm text-gray-700">
              I agree with the given{" "}
              <Text
                className="text-sm font-semibold text-gray-900 underline"
                onPress={() => setShowTerms(true)}
              >
                Terms
              </Text>{" "}
              and{" "}
              <Text
                className="text-sm font-semibold text-gray-900 underline"
                onPress={() => setShowTerms(true)}
              >
                Conditions.
              </Text>
            </Text>
          </View>
        </View>

        {/* Monthly Repayment */}
        <View className="mx-5 mt-8 items-center">
          <Text className="text-sm text-gray-500 mb-1">Monthly Repayment:</Text>
          <Text className="text-2xl font-bold text-gray-900">
            {formattedMonthlyRepayment}
          </Text>
        </View>
      </ScrollView>

      {/* Apply Button */}
      <View className="px-5 pb-6 pt-3 bg-white">
        <TouchableOpacity
          onPress={handleApply}
          disabled={!agreedToTerms || isSubmitting}
          className={`rounded-full py-4 items-center ${
            agreedToTerms && !isSubmitting ? "bg-gray-900" : "bg-gray-300"
          }`}
          style={{ opacity: agreedToTerms && !isSubmitting ? 1 : 0.7 }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              className={`text-base font-semibold ${agreedToTerms ? "text-white" : "text-gray-500"}`}
            >
              Apply
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Terms and Conditions Modal */}
      <TermsAndConditionsModal
        visible={showTerms}
        loanTitle={loanTitle}
        onAgree={handleAgreeTerms}
        onClose={() => setShowTerms(false)}
      />

      <CustomAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        icon={alert.icon}
        iconColor={alert.iconColor}
        onClose={() => setAlert((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}
