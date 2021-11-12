import * as fs from 'fs/promises';
import * as path from 'path';
import { window, commands, ExtensionContext, workspace, Uri, QuickPickItem } from 'vscode';

const ADD = '$(add) Add Project Folder';

export function activate(context: ExtensionContext) {
	let disposable = commands.registerCommand('open-project-folder.openproject', async () => {
		const settings = workspace.getConfiguration('open-project-folder');
		console.log();
		const folders = settings.get('projectFolders');
		if (Array.isArray(folders)) {
			let pickArray: QuickPickItem[] = [];
			if (folders.length > 0) {
				const promArr: Promise<Project[]>[] = [];
				folders.forEach(x => {
					promArr.push(readFolder(x));
				});
				const result = await Promise.all(promArr);
				const conArr = ([] as Project[]).concat(...result);

				pickArray = conArr.map(x => ({
					label: x.name,
					description: x.path
				})).sort((a, b) => a.label.toLowerCase() > b.label.toLowerCase() && 1 || -1);
			}
			pickArray.unshift({label: ADD});
			const pick = await window.showQuickPick(pickArray, {matchOnDescription: true, matchOnDetail: true});
			if (pick) {
				if (pick.label === ADD) {
					const newFolder = await window.showOpenDialog({
						canSelectFiles: false,
						canSelectFolders: true,
						canSelectMany: false,
						openLabel: 'Add',
						title: 'Add a project folder'
					});
					if (newFolder) {
						folders.push(newFolder[0].fsPath);
						settings.update('projectFolders', folders, true);
					}
				} else if (pick.description) {
					const uri = Uri.file(pick.description);
					if (!workspace.workspaceFolders) {
						commands.executeCommand('vscode.openFolder', uri);
					} else {
						commands.executeCommand('vscode.openFolder', uri, {forceNewWindow: true});
					}
				}
			}
		}
	});
	context.subscriptions.push(disposable);
}

export function deactivate() {}

async function readFolder(workspacePath: string) {
  try {
    const workspaceDirs = await fs.readdir(workspacePath);
    if (workspaceDirs) {
      const dirs = workspaceDirs.map(x => ({ name: x, path: path.join(workspacePath, x) }));
      const ret = await checkFolders(dirs);
      return ret;
    }
  } catch (err) {
    console.error(err);
  }
	return [];
}

async function checkFolders(workspaceDirs: Dir[]) {
  const projects: Project[] = [];
  for (const workspaceDir of workspaceDirs) {
    const result: Project | ProjectFolder | undefined = await checkFolder(workspaceDir);
		if (result) {
			if (!result.isProject) {
				const arr = await checkFolders(result.dirs);
				projects.push(...arr);
			} else {
				projects.push(result);
			}
		}
  }
  return projects;
}

async function checkFolder(workspaceDir: Dir): Promise<Project | ProjectFolder | undefined> {
  // wenn dateien vorhanden sind -> project
  // ansonsten nicht
  try {
    const dirs = await fs.readdir(workspaceDir.path);
    if (dirs) {
      const innerDirs = [];
      for (const dir of dirs) {
        const innerDir = path.join(workspaceDir.path, dir);
        const stats = await fs.stat(innerDir);
        if (stats.isFile()) {
          return { isProject: true, name: workspaceDir.name, path: workspaceDir.path } as Project;
        } else {
          innerDirs.push({ path: innerDir, name: dir });
        }
      }
      return { isProject: false, dirs: innerDirs } as ProjectFolder;
    }
  } catch (err) {
    console.error(err);
  }
}

interface Dir {
	name: string;
	path: string;
}

interface Project {
	isProject: true;
	name: string;
	path: string;
}

interface ProjectFolder {
	isProject: false;
	dirs: Dir[];
}
