type XlsxRuntime = {
  read: (
    data: ArrayBuffer,
    opts: unknown
  ) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: (sheet: unknown, opts?: unknown) => Array<Record<string, string>>;
  };
};

let loaderPromise: Promise<XlsxRuntime> | null = null;

declare global {
  interface Window {
    XLSX?: XlsxRuntime;
  }
}

const XLSX_CDN = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

export async function loadXlsx(): Promise<XlsxRuntime> {
  if (typeof window === "undefined") {
    throw new Error("XLSX parsing is only available in the browser");
  }
  if (window.XLSX) {
    return window.XLSX;
  }
  if (!loaderPromise) {
    loaderPromise = new Promise<XlsxRuntime>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = XLSX_CDN;
      script.async = true;
      script.onload = () => {
        if (window.XLSX) {
          resolve(window.XLSX);
        } else {
          reject(new Error("Failed to load XLSX library"));
        }
      };
      script.onerror = () => reject(new Error("Failed to load XLSX library"));
      document.head.appendChild(script);
    });
  }

  return loaderPromise;
}
