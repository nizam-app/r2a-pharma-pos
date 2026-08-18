import { useLocale } from "@/i18n";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import {
  createOwnerProduct,
  type CreateProductPayload,
} from "@/lib/ownerProduct";
import {
  EMPTY_PRODUCT_FORM,
  ProductForm,
  type ProductFormSubmission,
} from "./ProductForm";

function optional(value: string): string | undefined {
  return value || undefined;
}

/** Catalog-only create. Stock and prices remain in the Receive Stock flow. */
export function AddProductPage() {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();

  async function create(values: ProductFormSubmission): Promise<string> {
    const payload: CreateProductPayload = {
      name: values.name,
      genericName: optional(values.genericName),
      manufacturer: optional(values.manufacturer),
      strength: optional(values.strength),
      form: optional(values.form),
      sku: optional(values.sku),
      barcode: optional(values.barcode),
      category: optional(values.category),
      description: optional(values.description),
      requiresPrescription: values.requiresPrescription,
      coldChain: values.coldChain,
      storageNotes: optional(values.storageNotes),
      reorderLevel: values.reorderLevel ?? undefined,
      units: values.units,
    };
    const product = await createOwnerProduct(payload);
    return product.id;
  }

  return (
    <div className="w-full px-6 py-5">
      <nav aria-label={t("header.breadcrumb")} className="mb-2 flex items-center gap-1.5 text-xs text-muted">
        <button type="button" className="hover:text-foreground hover:underline" onClick={() => navigate("/inventory")}>{t("nav.inventory")}</button>
        <span>›</span>
        <span className="font-medium text-foreground">{t("inventory.add.crumb")}</span>
      </nav>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("inventory.add.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("inventory.add.subtitle")}</p>
      </div>
      <ProductForm
        mode="create"
        initialValues={EMPTY_PRODUCT_FORM}
        onSubmit={create}
        onSaved={(productId) => navigate(`/inventory/${encodeURIComponent(productId)}`)}
        onCancel={() => navigate("/inventory")}
      />
    </div>
  );
}
