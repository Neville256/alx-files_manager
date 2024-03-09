import path from 'path';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import { v4 as uuidv4 } from 'uuid';
import { promises as fsPromises } from 'fs';


export default class FilesController {
  static async postUpload(req, res) {
  
    const { name, type, parentId, isPublic, data } = req.body;
    const validFiles = [ 'folder', 'file', 'image' ];

    const user = await redisClient.get(`auth_${token}`);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized'});
    }
    if (!name) {
      res.status(400).json({error: 'Missing name'});
      return;
    }

    if (!type || validFiles.includes(type)) {
      res.status(400).json({error: 'Missing type'});
      return;
    }
	
    if (!data && type !== folder) {
      res.status(400).json({error: 'Missing data'});
      return;
    }

    if (parentId !== 0) {
    const files = await dbClient.nbFiles({ _id: ObjectId(parentId) });
      if (!files) {
        res.status(400).json({error: 'Parent not found'});
        return;
      }
      if (files.type !== validFiles[0]) {
        res.status(400).json({error: 'Parent is not a folder'});
        return;
      }
    }

    const user_id = ObjectId(userId);
    const parent_id = parentId ? ObjectId(parentId) : 0;
    const newFile = {
      userId: user_id,
      name: name,
      type: type,
      isPublic: isPublic,
      parentId: parent_id,
    };
    const relPath = process.env.FOLDER_PATH() || '/tmp/files_manager';

    if (type === 'folder') {
      const createdFile = await (await dbClient.nbUsers()).insertOne(newFile);
      return res.status(201).json(createdFile);
    } else {
      const filePath = path.join(relPath, uuidv4());
      await fsPromises.writeFile(filePath, Buffer.from(data, 'base64'));
      
      newFile.localPath = filePath;
      const createdFile = await (await dbClient.nbUsers()).insertOne(newFile);
      return res.status(201).json(createdFile);
    }

    
  }
}
