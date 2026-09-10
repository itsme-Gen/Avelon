import { Ionicons } from "@expo/vector-icons";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ToastKind = "success" | "error" | "info";

type ToastState = {
  message: string;
  kind: ToastKind;
  /** Bumped on every show so a repeat of the same message still re-animates. */
  seq: number;
};

const STYLES: Record<ToastKind, { bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { bg: "#10B981", icon: "checkmark-circle" },
  error: { bg: "#EF4444", icon: "alert-circle" },
  info: { bg: "#334155", icon: "information-circle" },
};

const VISIBLE_MS = 3200;

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Toast for brief confirmations. Anything needing a decision belongs in CustomAlert. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const seq = useRef(0);

  const show = useCallback((message: string, kind: ToastKind) => {
    seq.current += 1;
    setToast({ message, kind, seq: seq.current });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => show(m, "success"),
      error: (m) => show(m, "error"),
      info: (m) => show(m, "info"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <ToastBanner
          key={toast.seq}
          toast={toast}
          onDismiss={() => setToast(null)}
        />
      )}
    </ToastContext.Provider>
  );
}

function ToastBanner({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const style = STYLES[toast.kind];

  useEffect(() => {
    let cancelled = false;
    const leave = () =>
      Animated.timing(slide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        if (!cancelled) onDismiss();
      });

    Animated.spring(slide, {
      toValue: 1,
      useNativeDriver: true,
      friction: 9,
      tension: 70,
    }).start();

    const timer = setTimeout(leave, VISIBLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slide, onDismiss]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 16,
        right: 16,
        opacity: slide,
        transform: [
          { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) },
        ],
      }}
    >
      <Pressable
        onPress={onDismiss}
        accessibilityRole="alert"
        accessibilityLabel={toast.message}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: style.bg,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 14,
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Ionicons name={style.icon} size={22} color="white" />
        <Text style={{ color: "white", flex: 1, fontWeight: "600" }}>
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
