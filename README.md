# Codemods / jscodeshifts to upgrate MSW  from 1 to 2.


Upgrading MSW (https://mswjs.io) is a lot of work if you got a lot of handlers.

The documentation for upgrading is very good (https://mswjs.io/docs/migrations/1.x-to-2.x) and includes a set of Codemods 
that help you some of the way. For us they left a lot of work.

First we tried upgrading using aider, but in the end we ended up writing these codemods to run using JSCodeshift.

If you find them usefull, feel free to tell us - but do not expect any kind of support etc.

Running them should be quite straight forward. The run_codemods.sh script runs them in order for you.

Good luck.
