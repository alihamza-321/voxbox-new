// Workspace service for handling workspace operations
import { AuthService } from './auth';

import { API_BASE_URL } from '@/config/api.config';

export interface Workspace {
  id: string;
  name: string;
  websiteUrl?: string;
  industry?: string;
  country?: string;
  ownerUserId: string;
  renameCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  websiteUrl?: string;
  industry?: string;
  country?: string;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  websiteUrl?: string;
  industry?: string;
  country?: string;
  ownerUserId: string;
  renameCount: number;
  createdAt: string;
  updatedAt: string;
}

export class WorkspaceService {
  static async createWorkspace(data: CreateWorkspaceRequest): Promise<WorkspaceResponse> {
    try {
      console.log('WorkspaceService: Creating workspace');
      console.log('WorkspaceService: Data:', data);
      
      const response = await AuthService.makeAuthenticatedRequest(
        `${API_BASE_URL}/workspaces`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      console.log('WorkspaceService: Response status:', response.status);
      console.log('WorkspaceService: Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('WorkspaceService: Error response:', errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('WorkspaceService: Workspace created, full response:', result);
      
      // Backend wraps response in a 'data' object
      const workspaceData = result.data || result;
      
      console.log('WorkspaceService: Workspace data:', workspaceData);
      
      return workspaceData;
    } catch (error) {
      console.error('WorkspaceService: Error creating workspace:', error);
      throw error;
    }
  }

  static async getWorkspaces(): Promise<WorkspaceResponse[]> {
    try {
      console.log('WorkspaceService: Fetching workspaces');
      
      const response = await AuthService.makeAuthenticatedRequest(
        `${API_BASE_URL}/workspaces`,
        {
          method: 'GET',
        }
      );

      console.log('WorkspaceService: Response status:', response.status);
      console.log('WorkspaceService: Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('WorkspaceService: Error response:', errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('WorkspaceService: Workspaces fetched, full response:', result);
      
      // Backend wraps response in a 'data' object
      const workspacesData = result.data || result;
      
      console.log('WorkspaceService: Workspaces data:', workspacesData);
      
      return workspacesData;
    } catch (error) {
      console.error('WorkspaceService: Error fetching workspaces:', error);
      throw error;
    }
  }

  static async getWorkspace(id: string): Promise<WorkspaceResponse> {
    try {
      console.log('WorkspaceService: Fetching workspace:', id);
      
      const response = await AuthService.makeAuthenticatedRequest(
        `${API_BASE_URL}/workspaces/${id}`,
        {
          method: 'GET',
        }
      );

      console.log('WorkspaceService: Response status:', response.status);
      console.log('WorkspaceService: Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('WorkspaceService: Error response:', errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('WorkspaceService: Workspace fetched, full response:', result);
      
      // Backend wraps response in a 'data' object
      const workspaceData = result.data || result;
      
      console.log('WorkspaceService: Workspace data:', workspaceData);
      
      return workspaceData;
    } catch (error) {
      console.error('WorkspaceService: Error fetching workspace:', error);
      throw error;
    }
  }

  static async updateWorkspace(id: string, data: Partial<CreateWorkspaceRequest>): Promise<WorkspaceResponse> {
    try {
      console.log('WorkspaceService: Updating workspace:', id);
      console.log('WorkspaceService: Data:', data);
      
      const response = await AuthService.makeAuthenticatedRequest(
        `${API_BASE_URL}/workspaces/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      );

      console.log('WorkspaceService: Response status:', response.status);
      console.log('WorkspaceService: Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('WorkspaceService: Error response:', errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('WorkspaceService: Workspace updated, full response:', result);
      
      // Backend wraps response in a 'data' object
      const workspaceData = result.data || result;
      
      console.log('WorkspaceService: Workspace data:', workspaceData);
      
      return workspaceData;
    } catch (error) {
      console.error('WorkspaceService: Error updating workspace:', error);
      throw error;
    }
  }

  static async deleteWorkspace(id: string): Promise<void> {
    try {
      console.log('WorkspaceService: Deleting workspace:', id);
      
      const response = await AuthService.makeAuthenticatedRequest(
        `${API_BASE_URL}/workspaces/${id}`,
        {
          method: 'DELETE',
        }
      );

      console.log('WorkspaceService: Response status:', response.status);
      console.log('WorkspaceService: Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('WorkspaceService: Error response:', errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      console.log('WorkspaceService: Workspace deleted successfully');
    } catch (error) {
      console.error('WorkspaceService: Error deleting workspace:', error);
      throw error;
    }
  }
}
