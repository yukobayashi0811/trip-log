export type StayFormValues = {
  accommodationType: string;
  checkIn: string;
  checkOut: string;
  rating: string;
  notes: string;
};

export type StayFormSource = {
  accommodationType: string;
  checkIn: string;
  checkOut: string;
  rating: number | null;
  notes: string | null;
};

export const emptyStayValues: StayFormValues = {
  accommodationType: "",
  checkIn: "",
  checkOut: "",
  rating: "",
  notes: "",
};

export function stayFormValuesFromStay(stay: StayFormSource): StayFormValues {
  return {
    accommodationType: stay.accommodationType,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    rating: stay.rating === null ? "" : String(stay.rating),
    notes: stay.notes ?? "",
  };
}

export function hasUnsavedStayChanges(
  values: StayFormValues,
  initialValues: StayFormValues,
): boolean {
  return values.accommodationType !== initialValues.accommodationType
    || values.checkIn !== initialValues.checkIn
    || values.checkOut !== initialValues.checkOut
    || values.rating !== initialValues.rating
    || values.notes !== initialValues.notes;
}
