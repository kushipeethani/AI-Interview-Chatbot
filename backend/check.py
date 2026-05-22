path = open("main.py").readlines()
for i, line in enumerate(path[15:25], start=16):
    print(f"{i}: {line}", end="")
