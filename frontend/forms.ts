export const TextField = "TextField";
export type FormField = { type: "TextField"; label: string; id: string };

export const forms = {
  index: {
    label: "",
    formFields: [],
  },
  overflowingTrashBin: {
    label: "Overflowing Trash Bin",
    formFields: [
      { type: TextField, label: "Cross Street 1", id: "crossStreet1" },
      { type: TextField, label: "Cross Street 2", id: "crossStreet2" },
      { type: TextField, label: "Location Details", id: "locationDetails" },
    ] as FormField[],
  },
  treeProblem: {
    label: "Tree Problem",
    formFields: [],
  },
};
