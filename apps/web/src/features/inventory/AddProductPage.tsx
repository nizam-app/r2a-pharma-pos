import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Grid,
  Info,
  Layers,
  Package,
  Pill,
  Scale,
  Scan,
  Tag,
} from "lucide-react";
import React, { useState } from "react";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import {
  createOwnerProduct,
  type CreateProductPayload,
  type ProductUnitInput,
} from "@/lib/ownerProduct";

export function AddProductPage() {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();

  // Basic Information
  const [name, setName] = useState("Napa 500mg");
  const [genericName, setGenericName] = useState("Paracetamol");
  const [manufacturer, setManufacturer] = useState("Beximco Pharmaceuticals");
  const [strength, setStrength] = useState("500 mg");
  const [form, setForm] = useState("Tablet");

  // Identification
  const [sku, setSku] = useState("NAPA-500");
  const [barcode, setBarcode] = useState("8941100501234");
  const [category, setCategory] = useState("Analgesic");

  // Base Unit & Selling Prices
  const [baseUnit, setBaseUnit] = useState<"Piece" | "Tablet" | "Capsule">("Piece");
  const [piecePrice, setPiecePrice] = useState<string>("");
  const [stripPrice, setStripPrice] = useState<string>("");
  const [boxPrice, setBoxPrice] = useState<string>("");

  // Packaging & Selling Units
  const [stripEnabled, setStripEnabled] = useState(true);
  const [stripFactor, setStripFactor] = useState(10);
  const [boxEnabled, setBoxEnabled] = useState(true);
  const [boxFactor, setBoxFactor] = useState(100);

  // Additional Details (Right Rail)
  const [rxRequirement, setRxRequirement] = useState<"OTC" | "Rx">("OTC");
  const [coldChain, setColdChain] = useState(false);
  const [storageNotes, setStorageNotes] = useState("");
  const [reorderLevel, setReorderLevel] = useState<string>("50");

  // Status & Error states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dosage form options
  const dosageForms = [
    "Tablet",
    "Capsule",
    "Syrup",
    "Suspension",
    "Injection",
    "Drops",
    "Ointment",
    "Gel",
    "Inhaler",
    "Suppository",
    "Powder",
    "Cream",
  ];

  // Manufacturer suggestions
  const manufacturers = [
    "Beximco Pharmaceuticals",
    "Square Pharmaceuticals Ltd.",
    "Incepta Pharmaceuticals",
    "Renata Limited",
    "ACI Limited",
    "Eskayef Pharmaceuticals",
    "Healthcare Pharmaceuticals",
    "Acme Laboratories Ltd.",
    "Opsonin Pharma",
    "Aristopharma Ltd.",
    "Popular Pharmaceuticals",
    "Drug International Ltd.",
  ];

  // Category options
  const categoryOptions = [
    "Analgesic",
    "Antibiotic",
    "Antihistamine",
    "Gastrointestinal",
    "Cardiovascular",
    "Antidiabetic",
    "Respiratory",
    "Dermatological",
    "Vitamins & Minerals",
    "Ophthalmic",
    "CNS & Neurology",
    "OTC / General",
  ];

  // Update piece price and auto calculate derived prices
  const handlePiecePriceChange = (val: string) => {
    setPiecePrice(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (stripEnabled) {
        setStripPrice((num * stripFactor).toFixed(2));
      }
      if (boxEnabled) {
        setBoxPrice((num * boxFactor).toFixed(2));
      }
    }
  };

  const handleStripFactorChange = (val: number) => {
    const safeStrip = Math.max(1, val);
    setStripFactor(safeStrip);
    if (boxEnabled && boxFactor < safeStrip) {
      setBoxFactor(safeStrip * 10);
    }
    const pNum = parseFloat(piecePrice);
    if (!isNaN(pNum) && pNum > 0) {
      setStripPrice((pNum * safeStrip).toFixed(2));
    }
  };

  const handleBoxFactorChange = (val: number) => {
    const safeBox = Math.max(1, val);
    setBoxFactor(safeBox);
    const pNum = parseFloat(piecePrice);
    if (!isNaN(pNum) && pNum > 0) {
      setBoxPrice((pNum * safeBox).toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("inventory.add.requiredName"));
      return;
    }

    if (stripEnabled && stripFactor <= 0) {
      setError(t("inventory.add.invalidFactors"));
      return;
    }

    if (boxEnabled && boxFactor <= 0) {
      setError(t("inventory.add.invalidFactors"));
      return;
    }

    // Build units list
    const units: ProductUnitInput[] = [
      {
        unitType: "PIECE",
        factorToBase: 1,
        label: baseUnit !== "Piece" ? baseUnit : undefined,
      },
    ];

    if (stripEnabled) {
      units.push({
        unitType: "STRIP",
        factorToBase: stripFactor,
      });
    }

    if (boxEnabled) {
      units.push({
        unitType: "BOX",
        factorToBase: boxFactor,
      });
    }

    const payload: CreateProductPayload = {
      name: name.trim(),
      genericName: genericName.trim() || undefined,
      manufacturer: manufacturer.trim() || undefined,
      strength: strength.trim() || undefined,
      form: form.trim() || undefined,
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || undefined,
      category: category.trim() || undefined,
      requiresPrescription: rxRequirement === "Rx",
      coldChain,
      storageNotes: storageNotes.trim() || undefined,
      reorderLevel: reorderLevel.trim() ? parseInt(reorderLevel, 10) : undefined,
      units,
    };

    setSubmitting(true);
    setError(null);

    try {
      const created = await createOwnerProduct(payload);
      navigate(`/inventory/${encodeURIComponent(created.id)}`);
    } catch (err: unknown) {
      setSubmitting(false);
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("inventory.add.error"));
      }
    }
  };

  // Compute selling units label for summary
  const sellingUnitsText = [
    "Piece",
    stripEnabled ? "Strip" : null,
    boxEnabled ? "Box" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="w-full px-6 py-5">
      {/* Breadcrumb Navigation */}
      <nav
        aria-label={t("header.breadcrumb")}
        className="mb-2 flex items-center gap-1.5 text-xs text-slate-500"
      >
        <button
          type="button"
          className="hover:text-slate-800 dark:hover:text-slate-200 hover:underline"
          onClick={() => navigate("/inventory")}
        >
          {t("nav.inventory")}
        </button>
        <span>›</span>
        <span className="font-medium text-slate-800 dark:text-slate-200">
          {t("inventory.add.crumb")}
        </span>
      </nav>

      {/* Page Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t("inventory.add.title")}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t("inventory.add.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/inventory")}
          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          {t("inventory.add.cancel")}
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {/* Main Form Layout */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (8 cols): Form Fields */}
        <div className="space-y-5 lg:col-span-8">
          {/* Card 1: Product Information */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <Pill className="size-4 text-teal-600" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("inventory.add.basicInfo")}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Medicine Name */}
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("inventory.add.name")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("inventory.add.namePlaceholder")}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="hidden sm:block"></div>

              {/* Generic Name */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("inventory.add.generic")}
                </label>
                <input
                  type="text"
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  placeholder={t("inventory.add.genericPlaceholder")}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Manufacturer */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("inventory.add.manufacturer")}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="manufacturers-list"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder={t("inventory.add.manufacturerPlaceholder")}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 pr-8"
                  />
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-3.5 text-slate-400" />
                  <datalist id="manufacturers-list">
                    {manufacturers.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Strength */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("inventory.add.strength")}
                </label>
                <input
                  type="text"
                  value={strength}
                  onChange={(e) => setStrength(e.target.value)}
                  placeholder={t("inventory.add.strengthPlaceholder")}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Dosage Form */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("inventory.add.form")}
                </label>
                <div className="relative">
                  <select
                    value={form}
                    onChange={(e) => setForm(e.target.value)}
                    className="w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 pr-8"
                  >
                    {dosageForms.map((df) => (
                      <option key={df} value={df}>
                        {df}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-3.5 text-slate-400" />
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: Identification */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <Grid className="size-4 text-teal-600" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("inventory.add.identification")}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* SKU */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("inventory.add.sku")}
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder={t("inventory.add.skuPlaceholder")}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  {t("inventory.add.skuHint")}
                </p>
              </div>

              {/* Barcode */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("inventory.add.barcode")}
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder={t("inventory.add.barcodePlaceholder")}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 pr-9"
                  />
                  <Scan className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-slate-400" />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("inventory.add.category")}
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 pr-8"
                  >
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-3.5 text-slate-400" />
                </div>
              </div>
            </div>
          </section>

          {/* Middle Row: Base Unit & Selling Prices (2 Cards) */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Card 3: Base Unit */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-2">
                <Scale className="size-4 text-teal-600" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t("inventory.add.baseUnit")}
                </h2>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("inventory.add.primaryInventoryUnit")}
                </label>
                <div className="relative">
                  <select
                    value={baseUnit}
                    onChange={(e) => setBaseUnit(e.target.value as "Piece" | "Tablet" | "Capsule")}
                    className="w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 pr-8"
                  >
                    <option value="Piece">Piece</option>
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                  </select>
                  <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-2.5 size-3.5 text-slate-400" />
                </div>
                <p className="mt-3 text-[11px] text-slate-400">
                  {t("inventory.add.baseUnitHint")}
                </p>
              </div>
            </section>

            {/* Card 4: Selling Prices */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-2">
                <Tag className="size-4 text-teal-600" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t("inventory.add.sellingPrices")}
                </h2>
              </div>

              <div className="space-y-3">
                {/* Piece Price */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 w-16">
                    {t("inventory.add.unitPiece")}
                  </span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={piecePrice}
                      onChange={(e) => handlePiecePriceChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 pr-7"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1.5 text-xs text-slate-400">
                      ৳
                    </span>
                  </div>
                </div>

                {/* Strip Price */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 w-16">
                    {t("inventory.add.unitStrip")}
                  </span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={stripPrice}
                      onChange={(e) => setStripPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 pr-7"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1.5 text-xs text-slate-400">
                      ৳
                    </span>
                  </div>
                </div>

                {/* Box Price */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 w-16">
                    {t("inventory.add.unitBox")}
                  </span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={boxPrice}
                      onChange={(e) => setBoxPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 pr-7"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1.5 text-xs text-slate-400">
                      ৳
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Card 5: Packaging & Selling Units */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-teal-600" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t("inventory.add.packagingSellingUnits")}
                </h2>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {t("inventory.add.packagingSellingUnitsHint")}
            </p>

            {/* Interactive Unit Flow Diagram */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Tile 1: Piece */}
              <div className="flex min-w-[100px] flex-col items-center justify-center rounded-lg border border-teal-300 bg-teal-50/60 p-3.5 text-center shadow-2xs dark:border-teal-800 dark:bg-teal-950/30">
                <Pill className="size-5 text-teal-600 mb-1" />
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {baseUnit}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  1 pc (Base)
                </span>
              </div>

              {/* Arrow: x 10 */}
              <div className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                <span>→</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  x {stripFactor}
                </span>
                <span>→</span>
              </div>

              {/* Tile 2: Strip */}
              <div
                className={`flex min-w-[100px] flex-col items-center justify-center rounded-lg border p-3.5 text-center shadow-2xs transition-all ${
                  stripEnabled
                    ? "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
                    : "border-dashed border-slate-200 bg-slate-50/50 opacity-60 dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <div className="flex items-center gap-1 mb-1">
                  <Grid className="size-4 text-slate-600 dark:text-slate-400" />
                </div>
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Strip
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {stripFactor} pcs
                </span>
              </div>

              {/* Arrow: x 10 */}
              <div className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                <span>→</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  x {stripFactor > 0 ? Math.round(boxFactor / stripFactor) : 10}
                </span>
                <span>→</span>
              </div>

              {/* Tile 3: Box */}
              <div
                className={`flex min-w-[100px] flex-col items-center justify-center rounded-lg border p-3.5 text-center shadow-2xs transition-all ${
                  boxEnabled
                    ? "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
                    : "border-dashed border-slate-200 bg-slate-50/50 opacity-60 dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <Package className="size-4 text-slate-600 dark:text-slate-400 mb-1" />
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Box
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {boxFactor} pcs
                </span>
              </div>
            </div>

            {/* Packaging Unit Settings Drawer / Inputs */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stripEnabled}
                    onChange={(e) => setStripEnabled(e.target.checked)}
                    className="size-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    {t("inventory.add.enableStrip")}
                  </span>
                </label>
                {stripEnabled && (
                  <div className="flex items-center gap-1 text-xs">
                    <input
                      type="number"
                      min="1"
                      value={stripFactor}
                      onChange={(e) => handleStripFactorChange(parseInt(e.target.value || "1", 10))}
                      className="w-14 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-center text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <span className="text-[11px] text-slate-500">pcs</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={boxEnabled}
                    onChange={(e) => setBoxEnabled(e.target.checked)}
                    className="size-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    {t("inventory.add.enableBox")}
                  </span>
                </label>
                {boxEnabled && (
                  <div className="flex items-center gap-1 text-xs">
                    <input
                      type="number"
                      min="1"
                      value={boxFactor}
                      onChange={(e) => handleBoxFactorChange(parseInt(e.target.value || "1", 10))}
                      className="w-16 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-center text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <span className="text-[11px] text-slate-500">pcs</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Right Column (4 cols): Product Setup, Additional Details & Initial Stock */}
        <div className="space-y-5 lg:col-span-4">
          {/* Card 1: Product Setup Summary */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
              {t("inventory.add.productSetup")}
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">
                  {t("inventory.add.medicineLabel")}
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-right truncate max-w-[150px]">
                  {name || "—"}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">
                  {t("inventory.add.baseUnitLabel")}
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {baseUnit}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">
                  {t("inventory.add.sellingUnitsLabel")}
                </span>
                <span className="font-medium text-slate-900 dark:text-slate-100 text-right">
                  {sellingUnitsText}
                </span>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-slate-500 dark:text-slate-400">
                  {t("inventory.add.statusLabel")}
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500"></span>
                  {t("inventory.add.statusActive")}
                </span>
              </div>
            </div>
          </section>

          {/* Card 2: Additional Details */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
              {t("inventory.add.additionalDetails")}
            </h3>

            <div className="space-y-4 text-xs">
              {/* Prescription Requirement */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("inventory.add.rxRequirement")}
                </label>
                <div className="relative">
                  <select
                    value={rxRequirement}
                    onChange={(e) => setRxRequirement(e.target.value as "OTC" | "Rx")}
                    className="w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 pr-8"
                  >
                    <option value="OTC">{t("inventory.add.rxOtc")}</option>
                    <option value="Rx">{t("inventory.add.rxPrescription")}</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-3.5 text-slate-400" />
                </div>
              </div>

              {/* Cold Chain Storage Toggle */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t("inventory.add.coldChain")}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={coldChain}
                    onChange={(e) => setColdChain(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-teal-600"></div>
                </label>
              </div>

              {/* Storage Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("inventory.add.storageNotes")}
                </label>
                <textarea
                  rows={2}
                  value={storageNotes}
                  onChange={(e) => setStorageNotes(e.target.value)}
                  placeholder={t("inventory.add.storageNotesPlaceholder")}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 resize-none"
                />
              </div>

              {/* Reorder Level */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("inventory.add.reorderLevel")}
                </label>
                <input
                  type="number"
                  min="0"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(e.target.value)}
                  placeholder={t("inventory.add.reorderLevelPlaceholder")}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </section>

          {/* Card 3: Initial Stock Info Box */}
          <section className="rounded-xl border border-sky-200/90 bg-sky-50/50 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-sky-100 p-1 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 mt-0.5">
                <Info className="size-3.5" />
              </div>
              <div className="text-xs">
                <h4 className="font-semibold text-sky-950 dark:text-sky-100">
                  {t("inventory.add.initialStockTitle")}
                </h4>
                <p className="mt-1 text-[11px] text-sky-900/80 dark:text-sky-200/80 leading-relaxed">
                  {t("inventory.add.initialStockHint")}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom Bar: Action Buttons */}
        <div className="lg:col-span-12 flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            disabled={submitting}
            onClick={() => navigate("/inventory")}
            className="rounded-md border border-slate-300 bg-white px-5 py-2 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {t("inventory.add.cancel")}
          </button>

          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0D9488] hover:bg-teal-700 px-6 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? (
              <>
                <div className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {t("inventory.add.submitting")}
              </>
            ) : (
              <>
                <Check className="size-4 stroke-[2.5]" />
                {t("inventory.add.submit")}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
