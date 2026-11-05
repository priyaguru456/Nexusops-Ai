import { directoryRepository, type DirectoryFilter, type DirectoryUserDTO } from "./directory.repository";
import { AppError } from "../../lib/errors";

export class DirectoryService {
  async getDirectory(filter: DirectoryFilter) {
    return directoryRepository.findDirectoryUsers(filter);
  }

  async getDepartments() {
    return directoryRepository.findDepartments();
  }

  async getOrgRoots(departmentId?: string): Promise<DirectoryUserDTO[]> {
    return directoryRepository.findOrgRoots(departmentId);
  }

  async getDirectReports(managerId: string): Promise<DirectoryUserDTO[]> {
    return directoryRepository.findDirectReports(managerId);
  }

  async getUserTeam(userId: string) {
    const team = await directoryRepository.findUserTeam(userId);
    if (!team) {
      throw AppError.notFound("User not found in directory");
    }
    return team;
  }
}

export const directoryService = new DirectoryService();
