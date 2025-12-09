// Placeholder for staff types
// Will be implemented in future phases

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  saccoId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStaffInput {
  name: string;
  email: string;
  role: string;
  saccoId: string;
}

export interface UpdateStaffInput {
  name?: string;
  email?: string;
  role?: string;
}
