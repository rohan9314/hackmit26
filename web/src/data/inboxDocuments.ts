/** Judge-facing inbox examples. IDs match data/demo/ingestion/emails.json. */

export type InboxGroup = "bills_to_process" | "do_not_book" | "needs_investigation";

export type InboxDocument = {
  sample_id: string;
  title: string;
  kind: string;
  looks_like: string;
  description?: string;
  test: string;
  group: InboxGroup;
  from: string;
  to: string;
  sent_at: string;
  body: string;
  attachment?: {
    filename: string;
    heading: string;
    fields: Array<[string, string]>;
    lines?: string[];
    note?: string;
  };
};

export const INBOX_DOCUMENTS: InboxDocument[] = [
  {
    sample_id: "MSG-E-INV-001",
    title: "August warehouse supplies invoice",
    kind: "invoice",
    looks_like: "Vendor invoice",
    description: "Acme Supplies billed $12,450 for the Cambridge warehouse restock against purchase order PO-101.",
    test: "A real bill from Acme Supplies. Maximor should treat this as money the company owes and send it to accounts payable.",
    group: "bills_to_process",
    from: "Acme Supplies <billing@acmesupplies.example>",
    to: "ap@maximor.example",
    sent_at: "September 8, 2026",
    body: "Please find invoice ACM-2026-4410 for the August Cambridge warehouse restock. Amount due $12,450.00 against purchase order PO-101.",
    attachment: {
      filename: "ACM-2026-4410.pdf",
      heading: "Invoice",
      fields: [
        ["Vendor", "Acme Supplies"],
        ["Invoice number", "ACM-2026-4410"],
        ["Invoice date", "August 8 / September 8"],
        ["Amount due", "$12,450.00"],
        ["Due date", "October 8"],
        ["Purchase order", "PO-101"],
      ],
      lines: ["Warehouse packing supplies and cartons for the Cambridge office restock."],
    },
  },
  {
    sample_id: "MSG-E-QUOTE",
    title: "Quote for office renovation",
    kind: "quote",
    looks_like: "Looks like a bill, but is only a quote",
    description: "Harbor Build Co. sent quotation Q-8891 for $18,600 of Cambridge office renovation work. No purchase order has been issued.",
    test: "Looks similar to a bill, but this is only a price quote. Maximor should recognize that the company does not owe money yet.",
    group: "do_not_book",
    from: "Harbor Build Co. <sales@harborbuild.example>",
    to: "ap@maximor.example",
    sent_at: "September 9, 2026",
    body: "Please find quotation Q-8891 for the Cambridge office renovation. This is a quote, not a request for payment until you issue a purchase order.",
    attachment: {
      filename: "Q-8891-quote.pdf",
      heading: "Quotation",
      fields: [
        ["Vendor", "Harbor Build Co."],
        ["Quote number", "Q-8891"],
        ["Quote date", "September 9"],
        ["Quoted amount", "$18,600.00"],
        ["Valid through", "October 9"],
      ],
      lines: ["Office renovation for the Cambridge floor — millwork, paint, and furniture."],
      note: "This is a quote / estimate, not an invoice.",
    },
  },
  {
    sample_id: "MSG-E-RCPT",
    title: "Receipt for employee software purchase",
    kind: "receipt",
    looks_like: "Paid receipt",
    description: "Figma sent a $144 receipt for a software purchase that has already been paid.",
    test: "This is proof of a purchase that was already paid. It should not create a new amount owed.",
    group: "do_not_book",
    from: "Figma <receipts@figma.example>",
    to: "ap@maximor.example",
    sent_at: "September 12, 2026",
    body: "Payment received. This is a receipt for an employee software purchase that has already been paid. It is not a vendor invoice.",
    attachment: {
      filename: "figma-receipt.pdf",
      heading: "Receipt",
      fields: [
        ["Vendor", "Figma"],
        ["Receipt number", "FIG-SEP-19"],
        ["Payment date", "September 12"],
        ["Amount paid", "$144.00"],
      ],
      lines: ["Figma Organization plan — September"],
      note: "Paid in full. This is a receipt, not an invoice.",
    },
  },
  {
    sample_id: "MSG-E-STMT",
    title: "Vendor account statement — September",
    kind: "statement",
    looks_like: "Account statement",
    description: "Office Outfitters sent a September statement listing two earlier invoices totaling $1,840. It is a reminder, not a new bill.",
    test: "A statement lists earlier invoices. It is a reminder, not a new bill to put on the books.",
    group: "do_not_book",
    from: "Office Outfitters <ar@office.example>",
    to: "ap@maximor.example",
    sent_at: "September 30, 2026",
    body: "Attached is your monthly account statement of open items. This is not an invoice.",
    attachment: {
      filename: "statement-sep.pdf",
      heading: "Account statement",
      fields: [
        ["Vendor", "Office Outfitters"],
        ["Period", "September 2026"],
        ["Open item INV-8821", "$1,200.00"],
        ["Open item INV-8840", "$640.00"],
        ["Balance brought forward", "$1,840.00"],
      ],
      note: "This is an account statement, not an invoice.",
    },
  },
  {
    sample_id: "MSG-E-PO-MONITORS",
    title: "Purchase order for 40 monitors",
    kind: "purchase_order",
    looks_like: "Purchase order",
    description: "Maximor issued purchase order PO-440 to Northline Fabrication for 40 monitors, authorized at $18,400.",
    test: "This is Maximor authorizing a purchase. A purchase order is not a vendor invoice, so nothing should be booked as payable yet.",
    group: "do_not_book",
    from: "Maximor Procurement <procurement@maximor.example>",
    to: "ap@maximor.example",
    sent_at: "September 3, 2026",
    body: "Purchase order PO-440 has been issued to Northline Fabrication for 40 monitors. This is a purchase order, not a vendor invoice.",
    attachment: {
      filename: "PO-440.pdf",
      heading: "Purchase order",
      fields: [
        ["Purchase order", "PO-440"],
        ["Vendor", "Northline Fabrication"],
        ["Authorized amount", "$18,400.00"],
        ["Quantity", "40 monitors"],
      ],
      note: "This purchase order is not an invoice.",
    },
  },
  {
    sample_id: "MSG-E-DUP-001",
    title: "Second copy of ACM-2026-4410",
    kind: "duplicate",
    looks_like: "Possible duplicate invoice",
    description: "Acme Supplies resent invoice ACM-2026-4410 for $12,450. Paying this copy would mean paying twice for one shipment.",
    test: "This looks like the same Acme Supplies bill sent again. Paying both copies would mean paying twice for one shipment.",
    group: "needs_investigation",
    from: "Acme Supplies <ap@acmesupplies.example>",
    to: "ap@maximor.example",
    sent_at: "September 8, 2026",
    body: "Resending invoice ACM-2026-4410 in case the first copy was missed.",
    attachment: {
      filename: "ACM-2026-4410-copy.pdf",
      heading: "Invoice",
      fields: [
        ["Vendor", "Acme Supplies"],
        ["Invoice number", "ACM-2026-4410"],
        ["Invoice date", "September 8"],
        ["Amount due", "$12,450.00"],
        ["Purchase order", "PO-101"],
      ],
      note: "Second copy of a bill already received.",
    },
  },
  {
    sample_id: "MSG-E-MESSY",
    title: "Invoice with incomplete or confusing fields",
    kind: "malformed",
    looks_like: "Messy scanned invoice",
    description: "Northline Fabrication sent a poorly scanned $5,000 bill. The header is sloppy, but the invoice number, vendor, and amount can still be read.",
    test: "A poorly scanned bill with sloppy fields. Maximor should still try to read it, and only book it if the vendor, amount, and invoice number can be recovered.",
    group: "needs_investigation",
    from: "Northline Fabrication <billing@northline.example>",
    to: "ap@maximor.example",
    sent_at: "September 4, 2026",
    body: "scanned copy attached. sorry for the quality. pls pay when you can.",
    attachment: {
      filename: "nf201-scan.txt",
      heading: "Scanned invoice",
      fields: [
        ["Vendor", "Northline Fabrication"],
        ["Invoice number", "NF-201"],
        ["Invoice date", "September 4"],
        ["Amount due", "$5,000.00"],
        ["Purchase order", "PO-201"],
      ],
      note: "The scan is hard to read (the header looks like “1NVOICE”).",
    },
  },
  {
    sample_id: "MSG-E-MISSING",
    title: "Invoice missing a purchase order number",
    kind: "malformed",
    looks_like: "Incomplete invoice",
    description: "An unknown sender attached a file with no vendor, amount, invoice number, or purchase order printed.",
    test: "The attachment is missing the vendor, amount, and purchase order. Maximor should not invent those fields just to create a bill.",
    group: "needs_investigation",
    from: "unknown@vendor.example",
    to: "ap@maximor.example",
    sent_at: "September 11, 2026",
    body: "Please process the attached invoice. Several header fields did not print.",
    attachment: {
      filename: "invoice-unknown.pdf",
      heading: "Incomplete invoice",
      fields: [
        ["Vendor", "Not printed"],
        ["Invoice number", "Not printed"],
        ["Amount due", "Not printed"],
        ["Purchase order", "Missing"],
      ],
      note: "No amount, vendor, or invoice number is printed.",
    },
  },
];

export const INBOX_DOCUMENTS_BY_ID = Object.fromEntries(INBOX_DOCUMENTS.map((item) => [item.sample_id, item]));

export const DEFAULT_INBOX_SAMPLE = "MSG-E-INV-001";

export const GROUP_LABELS: Record<InboxGroup, string> = {
  bills_to_process: "Bills to process",
  do_not_book: "Do not book",
  needs_investigation: "Needs more investigation",
};
