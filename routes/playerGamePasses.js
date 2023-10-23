const express = require('express');
const axios = require('axios').default;
const router = express.Router();

const AMOUNT_TO_QUERY_PLACES = 50;
const AMOUNT_TO_QUERY_GAME_PASSES = 50;

/**
 * 
 * @returns {Array<number>}
 */
const returnNothing = (exception) => {
	console.warn(`Failed to call promiseUniverseGamePasses - ${exception}`);
	return [];
};

/**
 * Compresses an array of numbers into a string.
 * @param {Array<number>} array 
 * @returns {string}
 */
function compressIntegers(array) {
	let compressed = "";
	for (let index = 0; index < array.length; index += 1) {
		let value = array[index];
		while (value >= 0x20) {
			compressed += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
			value >>= 5;
		}

		compressed += String.fromCharCode(value + 63);
	}

	return compressed;
}

/**
 * @param {number | string} userId 
 * @returns {Promise<Array<number>>}
 */
function promiseRecentlyUpdatedGames(userId) {
	return axios.get(`https://games.roproxy.com/v2/users/${userId}/games?limit=${AMOUNT_TO_QUERY_PLACES}`).then(response => {
		if (response.status !== 200) throw new Error(`Error while getting recently updated games: ${response.status} - ${response.statusText}`);
		/** @type {Array<any>} */
		return response.data.data;
	}, (exception) => {
		console.warn(`Failed to call promiseRecentlyUpdatedGames - ${exception}`);
		return [];
	});
}

const REMOVE_ME = -1000;

/**
 * @param {number | string} universeId 
 * @returns {Promise<Array<number>>}
 */
function promiseUniverseGamePasses(universeId) {
	return axios.get(`https://games.roproxy.com/v1/games/${universeId}/game-passes?limit=${AMOUNT_TO_QUERY_GAME_PASSES}`).then(response => {
		if (response.status !== 200) throw new Error(`Error while getting universes games: ${response.status} - ${response.statusText}`);
		return response.data.data.map(({ id, price }) => price === undefined || price === null ? REMOVE_ME : id).filter((id) => id !== REMOVE_ME);
	}, (exception) => {
		console.warn(`Failed to call promiseUniverseGamePasses - ${exception}`);
		return [];
	});
}

/**
 * @param {number | string} userId 
 * @returns {Promise<string>}
 */
function promisePlayerGamePasses(userId) {
	return promiseRecentlyUpdatedGames(userId).then((games) =>
		Promise.all(games.map(({ id }) => promiseUniverseGamePasses(id).catch(returnNothing))),
	).then((gamePasses) => {
		const flattenedArray = [];
		let length = 0;

		for (const gamePassArray of gamePasses)
			for (const gamePassId of gamePassArray) flattenedArray[length++] = gamePassId;

		return compressIntegers(flattenedArray);
	});
}

/* GET GamePasses. */
router.get("/:id", async function (req, res, next) {
	try {
		res.json(await promisePlayerGamePasses(req.params.id));
	} catch (err) {
		console.error(`Error while getting GamePasses ${err.message}`);
		next(err);
	}
});

module.exports = router;
