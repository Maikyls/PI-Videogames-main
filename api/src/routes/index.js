const { Router, response } = require('express');
const axios = require('axios');
const { Genre, Videogame } = require('../db');
const e = require('express');
const { API_KEY } = process.env;
// Importar todos los routers;
// Ejemplo: const authRouter = require('./auth.js');


const router = Router();
//try to get 100 vg with data.next
const getApiInfo = async () => {
    const apiUrl = await axios.get(`https://api.rawg.io/api/games?key=${API_KEY}&page_size=40`);
    const vgInfo = await apiUrl.data.results.map(e => {         //bring just the necessary info
        return {
            id: e.id,
            name: e.name,
            genre: e.genres.map(e => e.name),
            image: e.background_image,
            released: e.released,
            rating: e.rating,
            platforms: e.platforms.map(e => e.platform.name)
        };
    });
    return vgInfo;
};

const getDbInfo = async () => {
    return Videogame.findAll({        //bring all videogames in db including genre model and its names
        include: {
            model: Genre,
            attributes: ['name'],
            through: {
                attributes: [],
            },
        }
    })
};

const getAllVg = async () => {
    const apiInfo = await getApiInfo();
    const dbInfo = await getDbInfo();
    const totalInfo = apiInfo.concat(dbInfo);
    return totalInfo;
}

// Configurar los routers
// Ejemplo: router.use('/auth', authRouter);

const searchInDb = async (name) => {
    const vgInDbName = await getDbInfo();
    const vgInfoByName = await vgInDbName.filter(e => e.name.toLowerCase().includes(name.toLowerCase()));
    return vgInfoByName;
}

const searchInApi = async (name) => {
    const apiSearch = await axios.get(`https://api.rawg.io/api/games?key=${API_KEY}&search=${name}&page_size=40`)
    const infoApiSearch = apiSearch.data.results;
    let vgMatch = await infoApiSearch.map(e => {
        return {
            id: e.id,
            name: e.name,
            genre: e.genres.map(e => e.name),
            image: e.background_image,
            released: e.released,
            rating: e.rating,
            platforms: e.platforms.map(e => e.platform.name)
        };
    });
    return vgMatch
}

router.get('/videogames', async (req, res) => {
    const name = req.query.name         //assign query value at name constant
    try {
        if (name) {
            let dbSearchName = await searchInDb(name);
            let apiSearchName = await searchInApi(name);
            let allSearchs = dbSearchName.concat(apiSearchName);
            allSearchs.length ?
                res.status(200).send(allSearchs) :
                res.status(400).send('Video Game has not developed yet, Do you will?');
        } else {
            res.status(200).send(await getAllVg());
        }
    } catch (error) {
        console.error(error)
    }

});

router.get('/genres', async (req, res) => {
    try {
        const callApiGenres = await axios.get(`https://api.rawg.io/api/genres?key=${API_KEY}`);
        const infoApiGenres = callApiGenres.data.results;
        const genres = infoApiGenres.map(e => e.name);
        genres.forEach(e => {
            Genre.findOrCreate({
                where: { name: e }
            });
        });
        const allGenres = await Genre.findAll();
        res.send(allGenres);
    } catch (error) {
        console.error(error)
    }
});

router.get('/videogame/:id', async (req, res) => {
    const id = req.params.id
    try {
        const vgInDbId = await getDbInfo();
        let vgInfoInDb = await vgInDbId.filter(e => e.id == id)
        if (vgInfoInDb.length)
            res.status(200).send(vgInfoInDb);
        else {
            const callApiId = await axios.get(`https://api.rawg.io/api/games/${id}?key=${API_KEY}`);
            if (callApiId.data.detail === 'Not found.') {
                res.status(400).send(`"VideoGame with id: ${id} doesn't exists yet"`)
            } else {
                const dataCallApi = callApiId.data
                const infoId = {
                    image: dataCallApi.background_image,
                    name: dataCallApi.name,
                    // genre: Genre.findAll({
                    //     where: {
                    //         name: dataCallApi.genres.map(e => e.name)
                    //     }
                    // }),
                    genre: dataCallApi.genres.map(e => e.name),
                    description: dataCallApi.description,
                    released: dataCallApi.released,
                    rating: dataCallApi.rating,
                    platforms: dataCallApi.platforms.map(e => e.platform.name),
                }
                res.status(200).send(infoId);
            }
        }
    } catch (error) {
        res.status(400).send(`"VideoGame with id: ${id} doesn't exists yet"`)
        console.error(error)
    }
});

router.post('/videogames', async (req, res) => {
    const { name, description, released, rating, genres, platforms, } = req.body;
    try {

        if (!name || !description || !platforms) {
            res.status(400).send('Name, description and platforms are required data')
        }
        let newVg = await Videogame.create({
            name,
            description,
            released,
            rating,
            platforms
        });

        let genresVg = await Genre.findAll({
            where: {
                name: genres
            }
        });

        newVg.addGenre(genresVg);
        res.status(200).send('Your VideoGame has been added successfully!');
    } catch (error) {
        console.error(error);
    }
})

module.exports = router;
