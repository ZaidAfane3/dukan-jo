"use client";

import { useEffect, useState } from "react";
import { enterSupportView } from "@/components/accounts";
import { useT } from "@/components/diwan/ui";

export function Enter() {
  const t = useT();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void enterSupportView().then((ok) => (ok ? window.location.replace("/dashboard") : setFailed(true)));
  }, []);
  return (
    <main className="grid min-h-screen place-items-center bg-page px-4 text-fg">
      {failed ? (
        <div className="max-w-sm text-center">
          <p className="font-semibold">{t("The store could not be opened. The visit may have ended.", "تعذر فتح المتجر. ربما انتهت الزيارة.")}</p>
          <a href="/diwan/shops" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
            {t("Back to shops", "العودة إلى المتاجر")}
          </a>
        </div>
      ) : (
        <p className="text-sm text-muted">{t("Opening the store…", "جارٍ فتح المتجر…")}</p>
      )}
    </main>
  );
}
