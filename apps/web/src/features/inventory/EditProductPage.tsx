import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import {
  fetchOwnerProduct,
  updateOwnerProduct,
  type OwnerProductDetail,
  type UpdateProductPayload,
} from "@/lib/ownerProduct";
import {
  ProductForm,
  productToFormValues,
  type ProductFormSubmission,
} from "./ProductForm";

function nullable(value: string): string | null {
  return value || null;
}

/** W2 Owner Edit Product — existing PATCH /products/:id, no stock mutation. */
export function EditProductPage({ productId }: { productId: string }) {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();
  const [product, setProduct] = useState<OwnerProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchOwnerProduct(productId)
      .then((payload) => {
        if (!cancelled) {
          setProduct(payload);
          setLoading(false);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setLoading(false);
        if (loadError instanceof ApiError && loadError.statusCode === 404) {
          setError(t("inventory.edit.notFound"));
        } else if (loadError instanceof ApiError) {
          setError(loadError.message);
        } else {
          setError(t("inventory.edit.loadError"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [productId, reload, t]);

  const initialValues = useMemo(
    () => (product ? productToFormValues(product) : null),
    [product],
  );

  async function save(values: ProductFormSubmission): Promise<string> {
    const payload: UpdateProductPayload = {
      name: values.name,
      genericName: nullable(values.genericName),
      manufacturer: nullable(values.manufacturer),
      strength: nullable(values.strength),
      form: nullable(values.form),
      sku: nullable(values.sku),
      barcode: nullable(values.barcode),
      category: nullable(values.category),
      description: nullable(values.description),
      requiresPrescription: values.requiresPrescription,
      coldChain: values.coldChain,
      storageNotes: nullable(values.storageNotes),
      reorderLevel: values.reorderLevel,
      isActive: values.isActive,
      units: values.units,
    };
    await updateOwnerProduct(productId, payload);
    return productId;
  }

  const detailPath = `/inventory/${encodeURIComponent(productId)}`;

  return (
    <div className="w-full px-6 py-5">
      <nav aria-label={t("header.breadcrumb")} className="mb-2 flex items-center gap-1.5 text-xs text-muted">
        <button type="button" className="hover:text-foreground hover:underline" onClick={() => navigate("/inventory")}>{t("nav.inventory")}</button>
        <span>›</span>
        {product ? <button type="button" className="max-w-52 truncate hover:text-foreground hover:underline" onClick={() => navigate(detailPath)}>{product.name}</button> : null}
        {product ? <span>›</span> : null}
        <span className="font-medium text-foreground">{t("inventory.edit.crumb")}</span>
      </nav>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("inventory.edit.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("inventory.edit.subtitle")}</p>
      </div>

      {loading && !product ? <p className="text-sm text-muted">{t("inventory.edit.loading")}</p> : null}
      {error && !product ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button type="button" className="rounded-md border border-border px-3 py-1 hover:bg-canvas" onClick={() => setReload((value) => value + 1)}>{t("inventory.retry")}</button>
          <button type="button" className="rounded-md border border-border px-3 py-1 hover:bg-canvas" onClick={() => navigate("/inventory")}>{t("inventory.detail.back")}</button>
        </div>
      ) : null}
      {product && initialValues ? (
        <ProductForm
          mode="edit"
          initialValues={initialValues}
          onSubmit={save}
          onSaved={() => navigate(detailPath)}
          onCancel={() => navigate(detailPath)}
        />
      ) : null}
    </div>
  );
}
