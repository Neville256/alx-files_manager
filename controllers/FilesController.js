import path from 'path';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import { v4 as uuidv4 } from 'uuid';
import { promises as fsPromises } from 'fs';


export default class FilesController {
  static async postUpload(req, res) {
    const token = req.headers.X-Token;
    const name = req.body.name;
    const type = req.body.type;
    const parentId = req.body.parentId ? req.body.parentId : 0;
    const isPublic = req.body.isPublic ? req.body.isPublic : false;
    const base64 = req.body.data ? req.body.data : ''; //for image and file
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
	
    if (!req.body.data && type !== 'folder') {
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
      res.status(201).json(createdFile);
     // return;
    } else {
      const filePath = path.join(relPath, uuidv4());
      await fsPromises.writeFile(filePath, Buffer.from(base64, 'base64'));
      
      newFile.localPath = filePath;
      const createdFile = await (await dbClient.nbUsers()).insertOne(newFile);
      res.status(201).json(createdFile);
    }
  }
  
  static async getShow(req, res) {
    const token = req.headers.X-Token;
    const user = await redisClient.get(`auth_${token}`);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized'});
      return;
    }
    const doc = await dbClient.nbFiles().findOne({
      _id: ObjectId(req.params.id),
      userId = ObjectId(user._id.toString()),
    }
    if (!doc) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(201).json({doc})
  }

  static async getIndex(req, res) {
    const token = req.headers.X-Token;
    const user = await redisClient.get(`auth_${token}`);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized'});
      return;
    }
    const parentId = req.query.parentId;
    const pageNo = parseInt(req.query.page) || 0; //equals to pageNumber
    const pageSize = 20;
    const startIndex = (pageNo) * pageSize;

    const filter = {
      userId: user._id,
      parentId: parentId ? parentId : 0,
    }
    
    const paginated = await dbClient.nbFiles().aggregate([
      { $match: filter },
      { $skip: startIndex },
      { $limit: pageSize },
      {
        $project: {
	  _id: 0,
	  id: '$_id',
	  userId: '$userId',
	  name: '$name',
	  type: '$type',
	  isPublic: '$isPublic',
	  parentId: '$parentId',
	},
      },
    ]).toArray();

    res.status(200).json(paginated);
  }

  static async putPublish(req, res) {
    const token = req.headers.X-Token;
    const user = await redisClient.get(`auth_${token}`);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized'});
      return;
    }

    const filter = {
      _id: ObjectId(req.params.id),
      userId: ObjectId(user._id.toString()),
    }
    const doc = await dbClient.nbFiles().findOne(doc);
    if (!doc) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    await dbClient.nbFiles().updateOne( doc,
	    { $set: { isPublic: true } });

    res.status(200).json({doc});
  }

  static async putUnpublish(req, res) {
    const token = req.headers.X-Token;
    const user = await redisClient.get(`auth_${token}`);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized'});
      return;
    }
  
    const doc = await dbClient.nbFiles().findOne(doc);
    if (!doc) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    await dbClient.nbFiles().updateOne( doc,
            { $set: { isPublic: false } });

    res.status(200).json({doc});
  }


  static async getFile(req, res) {
    const token = req.headers.X-Token;
    const user = await redisClient.get(`auth_${token}`);

    const filter = {
      _id: ObjectId(req.params.id),
    }
    const userId = ObjectId(user._id.toString())
    const file = await dbClient.nbFiles().findOne(filter);
    if (!file || file.isPublic === false && (file.userId.toString() !== userId)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
  
    if (file.type === 'folder') {
      res.status(400).json({ error: "A folder doesn't have content" });
      return;
    }

    
  }
}
