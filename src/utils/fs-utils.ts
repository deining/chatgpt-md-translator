import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { isNodeException } from './error-utils.js';

// We use this to output a bit frindlier error
export const readTextFile = async (filePath: string): Promise<string> => {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (e) {
    if (!isNodeException(e)) throw e;
    switch (e.code) {
      case 'EISDIR':
        throw new Error(`The specified path is a directory: ${filePath}`);
      case 'ENOENT':
        throw new Error(`File not found: ${filePath}`);
      case 'EACCES':
        throw new Error(`Permission denied: ${filePath}`);
      default:
        throw e;
    }
  }
};

export const checkDirectoryWritable = async (
  dirPath: string
): Promise<void> => {
  try {
    await fs.access(dirPath, fs.constants.F_OK | fs.constants.W_OK);
  } catch (dirError) {
    if (!isNodeException(dirError)) throw dirError;
    switch (dirError.code) {
      case 'ENOENT':
        throw new Error(`Directory does not exist: ${dirPath}`);
      case 'EACCES':
        throw new Error(`Directory is not writable: ${dirPath}`);
      default:
        throw dirError;
    }
  }
};

export const checkFileWritable = async (
  filePath: string,
  throwOnOverwrite: boolean
): Promise<void> => {
  try {
    await fs.access(filePath, fs.constants.F_OK | fs.constants.W_OK);
    // The file exists but can be overwritten
    if (throwOnOverwrite) throw new Error(`File already exists: ${filePath}`);
    return;
  } catch (e) {
    if (!isNodeException(e)) throw e;
    if (e.code === 'ENOENT') {
      // The file does not exist, check if directory is writable
      const dirPath = path.dirname(filePath);
      await checkDirectoryWritable(dirPath);
      return;
    }
    // File exists but is not writable, or other errors
    throw new Error(`File is not writable: ${filePath}`);
  }
};

export const extractPlaceholders = (
  inputFilePath: string,
  baseDir: string | null
): Record<string, string> => {
  const dir = path.dirname(inputFilePath);
  const ext = path.extname(inputFilePath);
  const basename = path.basename(inputFilePath, ext);
  const filename = path.basename(inputFilePath);
  const baseResult: Record<string, string> = {
    dir,
    main: path.join(dir, basename),
    basename,
    filename,
    ext: ext ? ext.slice(1) : ''
  };
  const baseDirResult = (() => {
    if (baseDir === null) return {} as Record<string, string>;
    const reldir = path.relative(baseDir, path.dirname(inputFilePath));
    return {
      basedir: baseDir,
      reldir,
      relmain: path.join(reldir, basename)
    };
  })();
  return { ...baseResult, ...baseDirResult };
};

export const resolveOutFilePath = (
  inputFilePath: string,
  baseDir: string | null,
  outputFilePath: string | null
): string => {
  if (outputFilePath === null) return inputFilePath;
  const placeholders = extractPlaceholders(inputFilePath, baseDir);
  return outputFilePath.replace(/{(\w+?)}/g, (_, key) => {
    return key in placeholders ? placeholders[key] : _;
  });
};
