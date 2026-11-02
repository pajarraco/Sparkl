import { useRouter } from "expo-router";
import { DetailScreen } from "../../../../../components/DetailScreen";
import { PropertyForm } from "../../../../../components/PropertyForm";
import { sparklTrpc } from "../../../../../providers/app-providers";
import { getStrings } from "../../../../../providers/i18n";

// Add a property (design.md Properties screens): on success, back to the
// list, which refetches on focus.

export default function NewPropertyScreen() {
  const strings = getStrings();
  const router = useRouter();
  const create = sparklTrpc.properties.create.useMutation();

  return (
    <DetailScreen
      testID="property-new-screen"
      title={strings.properties.addProperty}
      userRole="host"
    >
      <PropertyForm
        onSubmit={async (data) => {
          await create.mutateAsync(data);
          router.back();
        }}
        submitting={create.isPending}
      />
    </DetailScreen>
  );
}
