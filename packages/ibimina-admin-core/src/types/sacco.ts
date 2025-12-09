// Placeholder for SACCO types
// Will be implemented in future phases

export interface Sacco {
  id: string;
  name: string;
  district: string;
  sector: string;
  merchantCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSaccoInput {
  name: string;
  district: string;
  sector: string;
  merchantCode: string;
}

export interface UpdateSaccoInput {
  name?: string;
  district?: string;
  sector?: string;
  merchantCode?: string;
}
