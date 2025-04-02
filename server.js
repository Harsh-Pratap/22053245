require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const NodeCache = require("node-cache");

const app = express();
const cache = new NodeCache({ stdTTL: 60 }); // Cache data for 60 seconds

const PORT = process.env.PORT || 5000;
const BASE_URL = process.env.BASE_URL;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

const axiosConfig = {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
};

app.use(cors());

// Fetch Top Users (Users with the highest number of posts)
app.get("/top-users", async (req, res) => {
    try {
        let cachedData = cache.get("top-users");
        if (cachedData) return res.json(cachedData);

        const usersRes = await axios.get(`${BASE_URL}/users`, axiosConfig);
        const postsRes = await axios.get(`${BASE_URL}/posts`, axiosConfig);

        let userPostCount = {};
        postsRes.data.posts.forEach(post => {
            userPostCount[post.userId] = (userPostCount[post.userId] || 0) + 1;
        });

        let topUsers = Object.entries(userPostCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, count]) => ({
                id,
                name: usersRes.data.users[id],
                postCount: count,
            }));

        cache.set("top-users", topUsers);
        res.json(topUsers);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch top users" });
    }
});

// Fetch Trending (Popular) or Latest Posts
app.get("/posts", async (req, res) => {
    try {
        const type = req.query.type;
        if (!type || (type !== "latest" && type !== "popular")) {
            return res.status(400).json({ error: "Invalid type parameter" });
        }

        let cachedData = cache.get(`posts-${type}`);
        if (cachedData) return res.json(cachedData);

        const postsRes = await axios.get(`${BASE_URL}/posts`, axiosConfig);
        const commentsRes = await axios.get(`${BASE_URL}/comments`, axiosConfig);

        let posts = postsRes.data.posts;

        if (type === "popular") {
            let commentCount = {};
            commentsRes.data.comments.forEach(comment => {
                commentCount[comment.postId] = (commentCount[comment.postId] || 0) + 1;
            });

            let maxComments = Math.max(...Object.values(commentCount));
            let trendingPosts = posts
                .filter(post => commentCount[post.id] === maxComments)
                .map(post => ({ ...post, commentCount: commentCount[post.id] }));

            cache.set("posts-popular", trendingPosts);
            res.json(trendingPosts);
        } else {
            let latestPosts = posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);
            cache.set("posts-latest", latestPosts);
            res.json(latestPosts);
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch posts" });
    }
});

// Start the Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
