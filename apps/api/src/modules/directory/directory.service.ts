import { directoryRepository, type DirectoryFilter, type DirectoryUserDTO } from "./directory.repository";
import { AppError } from "../../lib/errors";

export class DirectoryService {
  async getDirectory(filter: DirectoryFilter) {
    return directoryRepository.findDirectoryUsers(filter);
  }

  async getDepartments(organizationId?: string) {
    return directoryRepository.findDepartments(organizationId);
  }

  async getOrgRoots(
    departmentId?: string,
    organizationId?: string
  ): Promise<DirectoryUserDTO[]> {
    return directoryRepository.findOrgRoots(departmentId, organizationId);
  }

  async getDirectReports(
    managerId: string,
    organizationId?: string
  ): Promise<DirectoryUserDTO[]> {
    return directoryRepository.findDirectReports(managerId, organizationId);
  }

  async getUserTeam(userId: string, organizationId?: string) {
    const team = await directoryRepository.findUserTeam(userId, organizationId);
    if (!team) {
      throw AppError.notFound("User not found in directory");
    }
    return team;
  }
}

export const directoryService = new DirectoryService();
