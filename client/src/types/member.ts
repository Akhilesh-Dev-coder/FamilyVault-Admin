export type Member = {
  id: string;
  name: string;
  image: string | null;
  address: string | null;
  phone: string | null;
  occupation: string | null;
  status: 'Deceased' | null;
  spouseObj: Member | null;
  children: Member[] | null;
};
